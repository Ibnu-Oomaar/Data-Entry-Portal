export const APP_CONFIG = Symbol('APP_CONFIG');

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  runMigrations: boolean;
  redisUrl: string;
  sessionSecret: string;
  cookieSecure: boolean;
  corsOrigins: string[];
  trustProxy: number;
  school: { name: string; shift: string };
  session: { teacherTtlSeconds: number; studentTtlSeconds: number };
  rateLimit: {
    loginFailuresMax: number;
    loginWindowSeconds: number;
    apiMax: number;
    apiWindowSeconds: number;
  };
  frontendDist?: string;
}

type Env = Record<string, string | undefined>;

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function int(env: Env, key: string, fallback: number, min = 0): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`Invalid environment variable ${key}: expected an integer >= ${min}, got "${raw}"`);
  }
  return n;
}

/** Reads and validates environment variables. Fails fast with a readable message. */
export function loadConfig(env: Env = process.env): AppConfig {
  const problems: string[] = [];
  const nodeEnvRaw = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnvRaw)) {
    problems.push(`NODE_ENV must be development, test or production (got "${nodeEnvRaw}")`);
  }
  const nodeEnv = nodeEnvRaw as AppConfig['nodeEnv'];
  const isProduction = nodeEnv === 'production';

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) problems.push('DATABASE_URL must be a postgres:// connection string');

  const redisUrl = env.REDIS_URL ?? '';
  if (!/^rediss?:\/\//.test(redisUrl)) problems.push('REDIS_URL must be a redis:// connection string');

  const sessionSecret = env.SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) problems.push('SESSION_SECRET must be at least 32 characters');
  if (isProduction && /change-me/i.test(sessionSecret)) problems.push('SESSION_SECRET still has the example value');

  if (problems.length) {
    throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  }

  return {
    nodeEnv,
    isProduction,
    port: int(env, 'PORT', 3000, 1),
    databaseUrl,
    databaseSsl: bool(env.DATABASE_SSL, false),
    runMigrations: bool(env.RUN_MIGRATIONS, true),
    redisUrl,
    sessionSecret,
    cookieSecure: bool(env.COOKIE_SECURE, isProduction),
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    trustProxy: int(env, 'TRUST_PROXY', 0),
    school: {
      name: env.SCHOOL_NAME?.trim() || 'Noradin Boys Secondary School',
      shift: env.SCHOOL_SHIFT?.trim() || 'Morning',
    },
    session: {
      teacherTtlSeconds: int(env, 'SESSION_TTL_TEACHER_HOURS', 8, 1) * 3600,
      studentTtlSeconds: int(env, 'SESSION_TTL_STUDENT_HOURS', 2, 1) * 3600,
    },
    rateLimit: {
      loginFailuresMax: int(env, 'RATE_LIMIT_LOGIN_FAILURES', 10, 1),
      loginWindowSeconds: int(env, 'RATE_LIMIT_LOGIN_WINDOW_SECONDS', 900, 1),
      apiMax: int(env, 'RATE_LIMIT_API_MAX', 600, 1),
      apiWindowSeconds: int(env, 'RATE_LIMIT_API_WINDOW_SECONDS', 60, 1),
    },
    frontendDist: env.FRONTEND_DIST?.trim() || undefined,
  };
}
