import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { APP_CONFIG, AppConfig } from '../../config/configuration';
import { StudentsService } from '../../students/students.service';
import { TeachersService } from '../../teachers/teachers.service';
import { Role } from '../auth.types';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators/auth.decorators';
import { RateLimitService } from '../rate-limit.service';
import { SESSION_COOKIE } from '../session.config';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isPublic(reflector: Reflector, ctx: ExecutionContext): boolean {
  return !!reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
}

/** 1) Generic per-IP request budget, persisted in PostgreSQL. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly limiter: RateLimitService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    await this.limiter.consumeApi(req.ip ?? 'unknown');
    return true;
  }
}

/**
 * 2) Authentication. The session lives in PostgreSQL; the user is re-read from PostgreSQL on every request,
 * so deactivating a teacher takes effect immediately and a student can only ever be "themselves".
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly teachers: TeachersService,
    private readonly students: StudentsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (isPublic(this.reflector, ctx)) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse();
    const sessionUser = req.session?.user;
    if (!sessionUser) throw this.unauthenticated();

    if (sessionUser.role === 'teacher') {
      const teacher = await this.teachers.findById(sessionUser.id);
      if (!teacher || !teacher.isActive) return this.kill(req, res);
      req.authUser = { role: 'teacher', id: teacher.id, fullName: teacher.fullName };
    } else if (sessionUser.role === 'student') {
      const s = await this.students.findById(sessionUser.id);
      if (!s) return this.kill(req, res);
      req.authUser = {
        role: 'student',
        id: s.id,
        studentId: s.studentId,
        name: s.name,
        classLevel: s.classLevel,
        section: s.section,
      };
    } else {
      return this.kill(req, res);
    }
    return true;
  }

  private unauthenticated() {
    return new AppException(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }

  private async kill(req: Request, res: { clearCookie: (n: string) => void }): Promise<never> {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie(SESSION_COOKIE);
    throw new AppException(HttpStatus.UNAUTHORIZED, 'SESSION_INVALID', 'Your session is no longer valid. Please sign in again.');
  }
}

/** 3) Role-based access. Fails closed: a route with no @Roles() is forbidden. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    if (isPublic(this.reflector, ctx)) return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const user = ctx.switchToHttp().getRequest<Request>().authUser;
    if (!roles?.length || !user || !roles.includes(user.role)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You do not have permission to do that.');
    }
    return true;
  }
}

/**
 * 4) CSRF defence for cookie sessions, on every state-changing request:
 *    - browsers' Origin header (when sent) must be this site or an allowed origin;
 *    - authenticated requests must also echo the per-session token in X-CSRF-Token.
 * Combined with SameSite=Lax, HttpOnly cookies and JSON-only bodies.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (origin && !this.originAllowed(req, origin)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CSRF_ORIGIN', 'Request origin is not allowed.');
    }
    if (isPublic(this.reflector, ctx)) return true;

    const expected = req.session?.csrfToken;
    const sent = req.headers['x-csrf-token'];
    if (!expected || typeof sent !== 'string' || !safeEqual(expected, sent)) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CSRF_TOKEN', 'Your session security token is missing or outdated. Please reload the page.');
    }
    return true;
  }

  private originAllowed(req: Request, origin: string): boolean {
    if (this.config.corsOrigins.includes(origin)) return true;
    return origin === `${req.protocol}://${req.get('host')}`;
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
