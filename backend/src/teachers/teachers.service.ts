import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { cleanDisplayName, normalizePersonName } from '../common/utils/normalize';
import { hashPassword, requiresPasswordRehash, verifyPassword } from '../auth/password';
import { Teacher } from './teacher.entity';

@Injectable()
export class TeachersService {
  constructor(@InjectRepository(Teacher) private readonly repo: Repository<Teacher>) {}

  /** Administrator-only provisioning (CLI). Provisioned accounts need a password before sign-in. */
  async provision(rawName: string): Promise<Teacher> {
    const fullName = cleanDisplayName(rawName ?? '');
    if (fullName.length < 2 || fullName.length > 150 || !/\p{L}/u.test(fullName) || /[\u0000-\u001f]/.test(fullName)) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_TEACHER_NAME',
        'A teacher name must be 2–150 characters and contain letters.',
      );
    }
    const normalizedName = normalizePersonName(fullName);
    const existing = await this.repo.findOne({ where: { normalizedName } });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'TEACHER_EXISTS',
        `A teacher named "${existing.fullName}" is already registered. Names must be unique so login is never ambiguous.`,
      );
    }
    return this.repo.save(this.repo.create({ fullName, normalizedName, isActive: true }));
  }

  async register(rawName: string, password: string): Promise<Teacher> {
    this.assertPassword(password);
    const fullName = cleanDisplayName(rawName ?? '');
    if (fullName.length < 2 || fullName.length > 150 || !/\p{L}/u.test(fullName) || /[\u0000-\u001f]/.test(fullName)) {
      throw new AppException(HttpStatus.UNPROCESSABLE_ENTITY, 'INVALID_TEACHER_NAME', 'A teacher name must be 2–150 characters and contain letters.');
    }
    const normalizedName = normalizePersonName(fullName);
    if (await this.repo.existsBy({ normalizedName })) {
      throw new AppException(HttpStatus.CONFLICT, 'TEACHER_EXISTS', 'A teacher with that name is already registered.');
    }
    const passwordHash = await hashPassword(password);
    try {
      return await this.repo.save(this.repo.create({ fullName, normalizedName, passwordHash, isActive: true }));
    } catch (err) {
      if (err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw new AppException(HttpStatus.CONFLICT, 'TEACHER_EXISTS', 'A teacher with that name is already registered.');
      }
      throw err;
    }
  }

  /** Password is selected only for authentication and is never returned by ordinary teacher queries. */
  async authenticate(rawName: string, password: string): Promise<Teacher | null> {
    const teacher = await this.repo
      .createQueryBuilder('teacher')
      .addSelect('teacher.passwordHash')
      .where('teacher.normalized_name = :normalizedName', { normalizedName: normalizePersonName(rawName) })
      .getOne();
    if (!teacher || !teacher.isActive || !(await verifyPassword(password, teacher.passwordHash))) return null;
    if (requiresPasswordRehash(teacher.passwordHash)) {
      teacher.passwordHash = await hashPassword(password);
      await this.repo.save(teacher);
    }
    return teacher;
  }

  async setPassword(rawName: string, password: string): Promise<void> {
    this.assertPassword(password);
    const teacher = await this.findByLoginName(rawName);
    if (!teacher) throw new AppException(HttpStatus.NOT_FOUND, 'TEACHER_NOT_FOUND', `No teacher named "${rawName}".`);
    teacher.passwordHash = await hashPassword(password);
    await this.repo.save(teacher);
  }

  private assertPassword(password: string): void {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
      throw new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'INVALID_PASSWORD',
        'Password must be between 12 and 128 characters.',
      );
    }
  }

  /** The unique index on normalized_name guarantees at most one match. */
  findByLoginName(rawName: string): Promise<Teacher | null> {
    return this.repo.findOne({ where: { normalizedName: normalizePersonName(rawName) } });
  }

  findById(id: string): Promise<Teacher | null> {
    return this.repo.findOne({ where: { id } });
  }

  list(): Promise<Teacher[]> {
    return this.repo.find({ order: { fullName: 'ASC' } });
  }

  async setActive(rawName: string, isActive: boolean): Promise<Teacher> {
    const teacher = await this.findByLoginName(rawName);
    if (!teacher) throw new AppException(HttpStatus.NOT_FOUND, 'TEACHER_NOT_FOUND', `No teacher named "${rawName}".`);
    teacher.isActive = isActive;
    return this.repo.save(teacher);
  }
}
