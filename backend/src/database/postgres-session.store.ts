import { Logger } from '@nestjs/common';
import session from 'express-session';
import { DataSource } from 'typeorm';

export class PostgresSessionStore extends session.Store {
  private readonly logger = new Logger(PostgresSessionStore.name);
  private lastCleanupAt = 0;
  private cleanupTask: Promise<void> | null = null;

  constructor(private readonly dataSource: DataSource) {
    super();
  }

  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void): void {
    this.dataSource
      .query('SELECT sess FROM app_sessions WHERE sid = $1 AND expires_at > now()', [sid])
      .then((rows: Array<{ sess: session.SessionData }>) => {
        this.maybeCleanupExpired();
        callback(null, rows[0]?.sess ?? null);
      })
      .catch((err: unknown) => callback(err));
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void): void {
    this.dataSource
      .query(
        `INSERT INTO app_sessions (sid, sess, expires_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expires_at = EXCLUDED.expires_at`,
        [sid, sessionData, this.expiry(sessionData)],
      )
      .then(() => {
        this.maybeCleanupExpired();
        callback?.();
      })
      .catch((err: unknown) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.dataSource
      .query('DELETE FROM app_sessions WHERE sid = $1', [sid])
      .then(() => callback?.())
      .catch((err: unknown) => callback?.(err));
  }

  touch(sid: string, sessionData: session.SessionData, callback?: () => void): void {
    this.dataSource
      .query('UPDATE app_sessions SET expires_at = $2 WHERE sid = $1', [sid, this.expiry(sessionData)])
      .then(() => {
        this.maybeCleanupExpired();
        callback?.();
      })
      .catch((err: unknown) => {
        this.logger.error(`session touch failed: ${err instanceof Error ? err.message : String(err)}`);
        callback?.();
      });
  }

  private expiry(sessionData: session.SessionData): Date {
    return sessionData.cookie.expires ?? new Date(Date.now() + (sessionData.cookie.maxAge ?? 24 * 60 * 60 * 1000));
  }

  private maybeCleanupExpired(): void {
    if (this.cleanupTask || Date.now() - this.lastCleanupAt < 5 * 60 * 1000) return;

    this.lastCleanupAt = Date.now();
    this.cleanupTask = Promise.all([
      this.dataSource.query('DELETE FROM app_sessions WHERE expires_at <= now()'),
      this.dataSource.query('DELETE FROM app_rate_limits WHERE expires_at <= now()'),
    ])
      .then(() => undefined)
      .catch((err: unknown) => {
        this.lastCleanupAt = 0;
        this.logger.warn(`expired session/rate-limit cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        this.cleanupTask = null;
      });
  }
}
