import { RedisStore } from 'connect-redis';
import type { RequestHandler } from 'express';
import session from 'express-session';
import type Redis from 'ioredis';
import type { AppConfig } from '../config/configuration';

export const SESSION_COOKIE = 'classes.sid';

/**
 * Server-side sessions stored in Redis. The browser only ever holds an opaque, signed, HttpOnly
 * session id; role and identity live on the server and cannot be edited by the client.
 */
export function createSessionMiddleware(config: AppConfig, redis: Redis): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    store: new RedisStore({ client: redis, prefix: 'sess:' }),
    resave: false,
    saveUninitialized: false,
    rolling: true, // idle timeout: every request pushes the expiry forward
    cookie: {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: config.session.teacherTtlSeconds * 1000,
    },
  });
}
