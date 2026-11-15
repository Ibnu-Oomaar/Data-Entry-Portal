import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import type Redis from 'ioredis';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { createSessionMiddleware } from './auth/session.config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { APP_CONFIG, AppConfig } from './config/configuration';
import { REDIS_CLIENT } from './redis/redis.module';

/** Shared by main.ts and the end-to-end tests so tests exercise the real pipeline. */
export function configureApp(app: INestApplication): void {
  const nest = app as NestExpressApplication;
  const config = app.get<AppConfig>(APP_CONFIG);
  const redis = app.get<Redis>(REDIS_CLIENT);

  nest.set('trust proxy', config.trustProxy);
  nest.disable('x-powered-by');
  // HSTS and "upgrade-insecure-requests" only make sense over HTTPS. On a plain-HTTP deployment
  // (COOKIE_SECURE=false, e.g. a school LAN) they would make browsers try to load the app's own assets over https and fail.
  nest.use(
    helmet({
      hsts: config.cookieSecure,
      contentSecurityPolicy: { directives: config.cookieSecure ? {} : { 'upgrade-insecure-requests': null } },
    }),
  );
  nest.use(createSessionMiddleware(config, redis));

  if (config.corsOrigins.length) {
    nest.enableCors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
    });
  }

  nest.setGlobalPrefix('api');
  nest.useGlobalPipes(createValidationPipe());
  nest.useGlobalFilters(new AllExceptionsFilter());
  nest.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  nest.enableShutdownHooks();

  // Production: serve the built React app from the same origin (cookies then need no CORS).
  if (config.frontendDist) {
    const dist = resolve(config.frontendDist);
    if (existsSync(join(dist, 'index.html'))) {
      nest.use(express.static(dist, { index: false, maxAge: '1h' }));
      nest.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
        res.sendFile(join(dist, 'index.html'));
      });
    }
  }
}
