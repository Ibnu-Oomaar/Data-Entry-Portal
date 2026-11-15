import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser, Role, StudentUser, TeacherUser } from '../auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Route needs no session (login, health). Everything else requires one. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Required on every non-public route. A route without @Roles is denied (fail closed),
 * so a forgotten decorator can never expose data.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<Request>();
  return req.authUser as AuthUser;
});

export const CurrentTeacher = createParamDecorator((_data: unknown, ctx: ExecutionContext): TeacherUser => {
  return ctx.switchToHttp().getRequest<Request>().authUser as TeacherUser;
});

export const CurrentStudent = createParamDecorator((_data: unknown, ctx: ExecutionContext): StudentUser => {
  return ctx.switchToHttp().getRequest<Request>().authUser as StudentUser;
});
