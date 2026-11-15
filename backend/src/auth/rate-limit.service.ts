import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { AppException } from '../common/errors/app.exception';
import { APP_CONFIG, AppConfig } from '../config/configuration';
import { REDIS_CLIENT } from '../redis/redis.module';

// Atomic "increment and set expiry on first hit" so a crash can never leave a counter without a TTL.
const HIT_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {n, redis.call('TTL', KEYS[1])}`;

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async hit(key: string, windowSeconds: number): Promise<{ count: number; ttl: number } | null> {
    try {
      const [count, ttl] = (await this.redis.eval(HIT_SCRIPT, 1, key, windowSeconds)) as [number, number];
      return { count, ttl };
    } catch (err) {
      // Availability over strictness for the generic API limiter; login limiter checks use peek().
      this.logger.warn(`rate limiter unavailable: ${(err as Error).message}`);
      return null;
    }
  }

  /** Generic per-IP request budget. */
  async consumeApi(ip: string): Promise<void> {
    const { apiMax, apiWindowSeconds } = this.config.rateLimit;
    const r = await this.hit(`rl:api:${ip}`, apiWindowSeconds);
    if (r && r.count > apiMax) this.reject(r.ttl);
  }

  /** Throws 429 if this IP already used up its failed-login budget. */
  async assertLoginAllowed(ip: string): Promise<void> {
    const { loginFailuresMax } = this.config.rateLimit;
    try {
      const raw = await this.redis.get(`rl:login-fail:${ip}`);
      if (raw !== null && Number(raw) >= loginFailuresMax) {
        const ttl = await this.redis.ttl(`rl:login-fail:${ip}`);
        this.reject(ttl);
      }
    } catch (err) {
      if (err instanceof AppException) throw err;
      this.logger.warn(`login limiter unavailable: ${(err as Error).message}`);
    }
  }

  async recordLoginFailure(ip: string): Promise<void> {
    await this.hit(`rl:login-fail:${ip}`, this.config.rateLimit.loginWindowSeconds);
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
