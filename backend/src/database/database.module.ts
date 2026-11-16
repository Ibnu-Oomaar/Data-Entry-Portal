import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';
import { buildTypeOrmOptions } from './typeorm.options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        buildTypeOrmOptions({
          databaseUrl: config.databaseUrl,
          databaseSsl: config.databaseSsl,
          runMigrations: config.runMigrations,
        }),
    }),
  ],
})
export class DatabaseModule {}
