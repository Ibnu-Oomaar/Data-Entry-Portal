import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException, FieldError } from '../errors/app.exception';

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = e.constraints ? Object.values(e.constraints).map((message) => ({ field, message })) : [];
    return [...own, ...flatten(e.children ?? [], field)];
  });
}

/** Strict validation: unknown fields are rejected, input is never implicitly coerced. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    exceptionFactory: (errors) => {
      const details = flatten(errors);
      return new AppException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'VALIDATION_ERROR',
        details[0]?.message ?? 'The submitted data is not valid.',
        details,
      );
    },
  });
}
