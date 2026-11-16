import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';
import { StudentsService } from '../students/students.service';
import { TeachersService } from '../teachers/teachers.service';
import type { AuthUser, Role } from './auth.types';
import { RateLimitService } from './rate-limit.service';
import { SESSION_COOKIE } from './session.config';

export interface SessionView {
  role: Role;
  user: Record<string, unknown>;
  csrfToken: string;
  school: { name: string; shift: string };
  expiresAt: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly teachers: TeachersService,
    private readonly students: StudentsService,
    private readonly limiter: RateLimitService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async loginTeacher(req: Request, name: string): Promise<SessionView> {
    const ip = req.ip ?? 'unknown';
    await this.limiter.assertLoginAllowed(ip);
    const teacher = await this.teachers.findByLoginName(name);
    if (!teacher || !teacher.isActive) {
      await this.limiter.recordLoginFailure(ip);
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'We could not find a registered teacher with that name. Check the spelling, or ask the administrator to register you.',
      );
    }
    await this.openSession(req, 'teacher', teacher.id, this.config.session.teacherTtlSeconds);
    return this.view(req, { role: 'teacher', id: teacher.id, fullName: teacher.fullName });
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
}
