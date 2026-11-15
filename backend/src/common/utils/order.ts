import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export type OrderEntry = [expression: string, direction: 'ASC' | 'DESC', nulls?: 'NULLS FIRST' | 'NULLS LAST'];

/** Case-insensitive name ordering that does not depend on the database's collation setting. */
export const NAME_ORDER_SQL = 'LOWER(s.name)';

/**
 * Applies ORDER BY entries in priority order.
 * TypeORM keys ORDER BY by expression, so adding the same expression twice would silently replace the
 * user's chosen direction with the tie-breaker's. Duplicates are therefore skipped (first one wins).
 */
export function applyOrder<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, entries: OrderEntry[]): SelectQueryBuilder<T> {
  const seen = new Set<string>();
  let first = true;
  for (const [expr, dir, nulls] of entries) {
    if (seen.has(expr)) continue;
    seen.add(expr);
    if (first) qb.orderBy(expr, dir, nulls);
    else qb.addOrderBy(expr, dir, nulls);
    first = false;
  }
  return qb;
}
