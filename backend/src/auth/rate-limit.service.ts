import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG } from '../config/configuration';
import type { AppConfig } from '../config/configuration';

@Injectable()
export class RateLimitService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async hit(key: string, windowSeconds: number): Promise<{ count: number; ttl: number }> {
    const [row] = await this.dataSource.query(
      `INSERT INTO app_rate_limits (key, count, expires_at)
       VALUES ($1, 1, now() + ($2 * interval '1 second'))
       ON CONFLICT (key) DO UPDATE
         SET count = CASE WHEN app_rate_limits.expires_at <= now() THEN 1 ELSE app_rate_limits.count + 1 END,
             expires_at = CASE WHEN app_rate_limits.expires_at <= now() THEN EXCLUDED.expires_at ELSE app_rate_limits.expires_at END
       RETURNING count::int AS count,
                 GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - now())))::int AS ttl`,
      [key, windowSeconds],
    );
    return { count: Number(row.count), ttl: Number(row.ttl) };
  }

  /** Generic per-IP request budget. */
  async consumeApi(ip: string): Promise<void> {
    const { apiMax, apiWindowSeconds } = this.config.rateLimit;
    const r = await this.hit(`api:${ip}`, apiWindowSeconds);
    if (r.count > apiMax) this.reject(r.ttl);
  }

  /** Throws 429 if this IP already used up its failed-login budget. */
  async assertLoginAllowed(ip: string): Promise<void> {
    const { loginFailuresMax } = this.config.rateLimit;
    const [row] = await this.dataSource.query(
      `SELECT count::int AS count,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM expires_at - now())))::int AS ttl
         FROM app_rate_limits
        WHERE key = $1 AND expires_at > now()`,
      [`login-fail:${ip}`],
    );
    if (row && Number(row.count) >= loginFailuresMax) this.reject(Number(row.ttl));
  }

  async recordLoginFailure(ip: string): Promise<void> {
    await this.hit(`login-fail:${ip}`, this.config.rateLimit.loginWindowSeconds);
  }

  private reject(ttl: number): never {
    const wait = Math.max(1, ttl);
    throw new AppException(
      HttpStatus.TOO_MANY_REQUESTS,
      'RATE_LIMITED',
      `Too many attempts. Please wait ${wait > 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`} and try again.`,
      undefined,
    ).withRetryAfter(wait);
  }
}
