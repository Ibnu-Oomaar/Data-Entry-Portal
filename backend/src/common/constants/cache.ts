export const CACHE_KEYS = {
  statsOverview: 'stats:overview',
} as const;

/** Dashboard statistics are cached briefly and invalidated whenever marks or students change. */
export const STATS_TTL_SECONDS = 60;
