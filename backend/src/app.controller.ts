import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { Public } from './auth/decorators/auth.decorators';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { REDIS_CLIENT } from './redis/redis.module';

@Controller()
export class AppController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Liveness/readiness for load balancers and Docker: checks PostgreSQL and Redis. */
  @Public()
  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException('A dependency is not reachable');
    }
    return { status: 'ok' };
  }

  /** School name/shift for the login pages (no personal data). */
  @Public()
  @Get('school')
  school() {
    return this.config.school;
  }
}
