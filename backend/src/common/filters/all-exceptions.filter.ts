import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { AppException } from '../errors/app.exception';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
};

/** Every error leaves the API in the same envelope: { success: false, error: { code, message, details? } } */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong on our side. Please try again.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      if (exception instanceof AppException && exception.retryAfterSeconds) {
        res.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
      const body = exception.getResponse();
      code = CODE_BY_STATUS[status] ?? 'ERROR';
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as { code?: string; message?: string | string[]; details?: unknown };
        if (b.code) code = b.code;
        if (Array.isArray(b.message)) message = b.message.join('; ');
        else if (b.message) message = b.message;
        details = b.details;
      }
    } else if (exception instanceof QueryFailedError) {
      const pg = (exception as QueryFailedError & { driverError?: { code?: string } }).driverError;
      if (pg?.code === '23505') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE';
        message = 'That record already exists.';
      } else if (pg?.code === '23514') {
        status = HttpStatus.UNPROCESSABLE_ENTITY;
        code = 'CONSTRAINT_VIOLATION';
        message = 'The data violates a database rule.';
      } else {
        this.logger.error(`${req.method} ${req.url}: ${exception.message}`, exception.stack);
      }
    } else if (isHttpLikeError(exception)) {
      // body-parser errors (malformed JSON, payload too large) arrive as plain errors with a status
      status = exception.status;
      code = CODE_BY_STATUS[status] ?? 'BAD_REQUEST';
      message = status === 413 ? 'The request is too large.' : 'The request could not be read.';
    } else {
      const err = exception as Error;
      this.logger.error(`${req.method} ${req.url}: ${err?.message}`, err?.stack);
    }

    res.status(status).json({
      success: false,
      error: { code, message, statusCode: status, ...(details ? { details } : {}) },
    });
  }
}

function isHttpLikeError(e: unknown): e is { status: number } {
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { status?: unknown }).status === 'number' &&
    (e as { status: number }).status >= 400 &&
    (e as { status: number }).status < 500
  );
}
