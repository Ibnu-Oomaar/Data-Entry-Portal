import type { RequestHandler } from 'express';
import session from 'express-session';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../config/configuration';
import { PostgresSessionStore } from '../database/postgres-session.store';

export const SESSION_COOKIE = 'classes.sid';

/**
 * Server-side sessions stored in PostgreSQL. The browser only ever holds an opaque, signed, HttpOnly
 * session id; role and identity live on the server and cannot be edited by the client.
 */
export function createSessionMiddleware(config: AppConfig, dataSource: DataSource): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    secret: config.sessionSecret,
    store: new PostgresSessionStore(dataSource),
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
