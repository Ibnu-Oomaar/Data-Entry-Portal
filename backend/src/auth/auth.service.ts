import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';
import { StudentsService } from '../students/students.service';
import { TeacherPasskey } from '../teachers/teacher-passkey.entity';
import { TeachersService } from '../teachers/teachers.service';
import type { AuthUser, Role, TeacherUser } from './auth.types';
import { RateLimitService } from './rate-limit.service';
import { SESSION_COOKIE } from './session.config';

export interface SessionView {
  role: Role;
  user: Record<string, unknown>;
  csrfToken: string;
  school: { name: string; shift: string };
  expiresAt: string | null;
}

type PasskeyPurpose = 'authentication' | 'registration';
type StoredPasskeyChallenge = { challenge: string; teacher_id: string };
const SINGLE_TEACHER_NAME = 'Khalid Harun';
const PASSKEY_CHALLENGE_TTL_SECONDS = 300;

@Injectable()
export class AuthService {
  constructor(
    private readonly teachers: TeachersService,
    private readonly students: StudentsService,
    private readonly limiter: RateLimitService,
    @InjectRepository(TeacherPasskey) private readonly passkeys: Repository<TeacherPasskey>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async loginTeacher(req: Request, name: string, password: string): Promise<SessionView> {
    const ip = req.ip ?? 'unknown';
    await this.limiter.assertLoginAllowed(ip);
    const teacher = await this.teachers.authenticate(name, password);
    if (!teacher) {
      await this.limiter.recordLoginFailure(ip);
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'The name or password is incorrect.',
      );
    }
    await this.openSession(req, 'teacher', teacher.id, this.config.session.teacherTtlSeconds);
    return this.view(req, { role: 'teacher', id: teacher.id, fullName: teacher.fullName });
  }

  async passkeyLoginOptions(req: Request) {
    const ip = req.ip ?? 'unknown';
    await this.limiter.assertLoginAllowed(ip);
    const teacher = await this.teachers.findByLoginName(SINGLE_TEACHER_NAME);
    if (!teacher || !teacher.isActive) return this.rejectPasskeyLogin(ip);

    const passkeys = await this.passkeys.find({ where: { teacherRefId: teacher.id } });
    if (!passkeys.length) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'PASSKEY_NOT_REGISTERED',
        'No passkey is set up yet. Use password sign-in once, then add a passkey from your profile.',
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: this.config.webauthn.rpId,
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })),
      userVerification: 'required',
    });
    const flowId = await this.storePasskeyChallenge(req, teacher.id, 'authentication', options.challenge);
    return { flowId, options };
  }

  async loginTeacherWithPasskey(
    req: Request,
    flowId: string,
    response: AuthenticationResponseJSON,
  ): Promise<SessionView> {
    const ip = req.ip ?? 'unknown';
    await this.limiter.assertLoginAllowed(ip);
    const challenge = await this.consumePasskeyChallenge(req, flowId, 'authentication');
    if (!challenge) return this.rejectPasskeyLogin(ip);

    const teacher = await this.teachers.findById(challenge.teacher_id);
    if (!teacher || !teacher.isActive || teacher.normalizedName !== SINGLE_TEACHER_NAME.toLowerCase()) {
      return this.rejectPasskeyLogin(ip);
    }

    const verified = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(TeacherPasskey);
      const passkey = await repo.findOne({
        where: { credentialId: response.id, teacherRefId: teacher.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!passkey) return false;

      let result;
      try {
        result = await verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: this.config.webauthn.origins,
          expectedRPID: this.config.webauthn.rpId,
          credential: {
            id: passkey.credentialId,
            publicKey: new Uint8Array(passkey.publicKey),
            counter: passkey.counter,
            transports: passkey.transports,
          },
          requireUserVerification: true,
        });
      } catch (error) {
        if (error instanceof Error) return false;
        throw error;
      }
      if (!result.verified || !result.authenticationInfo.userVerified) return false;

      passkey.counter = result.authenticationInfo.newCounter;
      passkey.deviceType = result.authenticationInfo.credentialDeviceType;
      passkey.backedUp = result.authenticationInfo.credentialBackedUp;
      await repo.save(passkey);
      return true;
    });
    if (!verified) return this.rejectPasskeyLogin(ip);

    await this.openSession(req, 'teacher', teacher.id, this.config.session.teacherTtlSeconds);
    return this.view(req, { role: 'teacher', id: teacher.id, fullName: teacher.fullName });
  }

  async passkeyRegistrationOptions(req: Request, user: AuthUser) {
    const teacher = this.requireTeacher(user);
    const passkeys = await this.passkeys.find({ where: { teacherRefId: teacher.id } });
    const options = await generateRegistrationOptions({
      rpName: this.config.webauthn.rpName,
      rpID: this.config.webauthn.rpId,
      userName: teacher.fullName,
      userDisplayName: teacher.fullName,
      userID: new Uint8Array(Buffer.from(teacher.id)),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      excludeCredentials: passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports,
      })),
    });
    const flowId = await this.storePasskeyChallenge(req, teacher.id, 'registration', options.challenge);
    return { flowId, options };
  }

  async registerPasskey(
    req: Request,
    user: AuthUser,
    flowId: string,
    response: RegistrationResponseJSON,
  ): Promise<{ registered: true }> {
    const teacher = this.requireTeacher(user);
    const challenge = await this.consumePasskeyChallenge(req, flowId, 'registration');
    if (!challenge || challenge.teacher_id !== teacher.id) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'PASSKEY_CHALLENGE_EXPIRED', 'The passkey setup expired. Please try again.');
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.config.webauthn.origins,
        expectedRPID: this.config.webauthn.rpId,
        requireUserVerification: true,
      });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_PASSKEY_RESPONSE', 'The passkey could not be verified. Please try again.');
    }
    if (!verification.verified || !verification.registrationInfo.userVerified) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_PASSKEY_RESPONSE', 'The passkey could not be verified. Please try again.');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    try {
      await this.passkeys.save(
        this.passkeys.create({
          teacherRefId: teacher.id,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports ?? [],
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw new AppException(HttpStatus.CONFLICT, 'PASSKEY_ALREADY_REGISTERED', 'This passkey is already registered.');
      }
      throw error;
    }
    return { registered: true };
  }

  async listPasskeys(user: AuthUser): Promise<{ count: number }> {
    const teacher = this.requireTeacher(user);
    return { count: await this.passkeys.countBy({ teacherRefId: teacher.id }) };
  }

  async loginStudent(req: Request, studentId: number): Promise<SessionView> {
    const ip = req.ip ?? 'unknown';
    await this.limiter.assertLoginAllowed(ip);
    const student = await this.students.findBySchoolId(studentId);
    if (!student) {
      await this.limiter.recordLoginFailure(ip);
      throw new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'That Student ID was not found. Check the number and try again.');
    }
    await this.openSession(req, 'student', student.id, this.config.session.studentTtlSeconds);
    return this.view(req, {
      role: 'student',
      id: student.id,
      studentId: student.studentId,
      name: student.name,
      classLevel: student.classLevel,
      section: student.section,
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  view(req: Request, user: AuthUser): SessionView {
    const { role, id, ...rest } = user;
    void id;
    return {
      role,
      user: rest,
      csrfToken: req.session.csrfToken as string,
      school: this.config.school,
      expiresAt: req.session.cookie.expires ? new Date(req.session.cookie.expires).toISOString() : null,
    };
  }

  /** New session id on every login (prevents session fixation) plus a fresh CSRF token. */
  private async openSession(req: Request, role: Role, id: string, ttlSeconds: number): Promise<void> {
    await new Promise<void>((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
    req.session.user = { role, id };
    req.session.csrfToken = randomBytes(32).toString('hex');
    req.session.cookie.maxAge = ttlSeconds * 1000;
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
  }

  private requireTeacher(user: AuthUser): TeacherUser {
    if (user.role !== 'teacher' || user.fullName !== SINGLE_TEACHER_NAME) {
      throw new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only Khalid Harun can manage passkeys.');
    }
    return user;
  }

  private async storePasskeyChallenge(
    req: Request,
    teacherId: string,
    purpose: PasskeyPurpose,
    challenge: string,
  ): Promise<string> {
    const flowId = randomUUID();
    await this.dataSource.query(`DELETE FROM teacher_passkey_challenges WHERE expires_at <= now() OR session_id = $1 AND purpose = $2`, [
      req.sessionID,
      purpose,
    ]);
    await this.dataSource.query(
      `INSERT INTO teacher_passkey_challenges (id, session_id, teacher_id, purpose, challenge, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 second'))`,
      [flowId, req.sessionID, teacherId, purpose, challenge, PASSKEY_CHALLENGE_TTL_SECONDS],
    );
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    return flowId;
  }

  private async consumePasskeyChallenge(
    req: Request,
    flowId: string,
    purpose: PasskeyPurpose,
  ): Promise<StoredPasskeyChallenge | null> {
    const [challenge] = await this.dataSource.query(
      `DELETE FROM teacher_passkey_challenges
        WHERE id = $1 AND session_id = $2 AND purpose = $3 AND expires_at > now()
        RETURNING challenge, teacher_id`,
      [flowId, req.sessionID, purpose],
    );
    return challenge ?? null;
  }

  private async rejectPasskeyLogin(ip: string): Promise<never> {
    await this.limiter.recordLoginFailure(ip);
    throw new AppException(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'The passkey could not be verified.');
  }
}
