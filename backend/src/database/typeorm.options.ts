import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { Assessment } from '../assessments/assessment.entity';
import { Student } from '../students/student.entity';
import { Teacher } from '../teachers/teacher.entity';
import { TeacherClassSection } from '../teachers/teacher-class-section.entity';

export function buildTypeOrmOptions(opts: {
  databaseUrl: string;
  databaseSsl?: boolean;
  runMigrations?: boolean;
}): DataSourceOptions {
  return {
    type: 'postgres',
    url: opts.databaseUrl,
    ssl: opts.databaseSsl ? { rejectUnauthorized: false } : false,
    entities: [Teacher, TeacherClassSection, Student, Assessment],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsRun: opts.runMigrations ?? false,
    // Schema changes only ever happen through reviewed migrations.
    synchronize: false,
    // gen_random_uuid() is built into PostgreSQL 13+, no extension needed.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    logging: ['error', 'warn'],
  };
}
