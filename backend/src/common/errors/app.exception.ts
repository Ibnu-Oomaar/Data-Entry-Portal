import { HttpException, HttpStatus } from '@nestjs/common';

export interface FieldError {
  field: string;
  message: string;
}

/** Business error with a stable machine-readable code the frontend can switch on. */
export class AppException extends HttpException {
  retryAfterSeconds?: number;

  constructor(
    status: HttpStatus,
    public readonly code: string,
    message: string,
    public readonly details?: FieldError[],
  ) {
    super({ code, message, details }, status);
  }

  /** Adds a Retry-After header to the response (used by rate limiting). */
  withRetryAfter(seconds: number): this {
    this.retryAfterSeconds = seconds;
    return this;
  }
}
