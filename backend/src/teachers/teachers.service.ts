
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { cleanDisplayName, normalizePersonName } from '../common/utils/normalize';
import { Teacher } from './teacher.entity';

@Injectable()
export class TeachersService {
  constructor(@InjectRepository(Teacher) private readonly repo: Repository<Teacher>) {}

  /** Administrator-only provisioning (CLI). */
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
    try {
      return await this.repo.save(this.repo.create({ fullName, normalizedName, isActive: true }));
    } catch (err) {
      if (err instanceof QueryFailedError && (err as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw new AppException(HttpStatus.CONFLICT, 'TEACHER_EXISTS', 'A teacher with that name is already registered.');
      }
      throw err;
    }
  }

  /** Authenticate a teacher using their registered name. */
  async authenticate(rawName: string): Promise<Teacher | null> {
    const teacher = await this.findByLoginName(rawName);
    return teacher && teacher.isActive ? teacher : null;
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
