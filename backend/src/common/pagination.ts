export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Returned by list endpoints; the envelope interceptor turns it into { success, data, meta }. */
export class PaginatedResult<T> {
  readonly meta: PageMeta;
  constructor(
    public readonly items: T[],
    total: number,
    page: number,
    pageSize: number,
  ) {
    this.meta = { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
}
