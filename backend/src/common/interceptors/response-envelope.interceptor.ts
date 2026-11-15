import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '../pagination';

/** Wraps every successful response as { success: true, data, meta? }. */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((payload) => {
        if (payload instanceof PaginatedResult) {
          return { success: true, data: payload.items, meta: payload.meta };
        }
        return { success: true, data: payload === undefined ? null : payload };
      }),
    );
  }
}
