import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from './auth/decorators/auth.decorators';
import { APP_CONFIG, AppConfig } from './config/configuration';

@Controller()
export class AppController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Liveness/readiness for load balancers: checks PostgreSQL. */
  @Public()
  @Get('health')
  async health() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('The database is not reachable');
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
