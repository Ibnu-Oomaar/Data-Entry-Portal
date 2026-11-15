import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm.options';

/** Used by the TypeORM CLI (migration:generate / migration:run) and by the CLI scripts. */
export default new DataSource(
  buildTypeOrmOptions({
    databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:devpass@127.0.0.1:5432/classes_portal',
    databaseSsl: process.env.DATABASE_SSL === 'true',
  }),
);
