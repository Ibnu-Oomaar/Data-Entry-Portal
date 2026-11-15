import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm.options';

/** Used by the TypeORM CLI (migration:generate / migration:run) and by the CLI scripts. */
export default new DataSource(
  buildTypeOrmOptions({
    databaseUrl: process.env.DATABASE_URL ?? '',
    databaseSsl:
      process.env.DATABASE_SSL === 'true' ||
      /(?:[?&]sslmode=require\b|\.neon\.tech\b)/i.test(process.env.DATABASE_URL ?? ''),
  }),
);
