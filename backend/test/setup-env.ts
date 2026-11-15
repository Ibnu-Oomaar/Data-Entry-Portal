// Tests run against a throw-away PostgreSQL database — never the development data.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:devpass@127.0.0.1:5432/classes_portal_test';
process.env.SESSION_SECRET = 'test-session-secret-test-session-secret-0123456789';
process.env.RUN_MIGRATIONS = 'true';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.RATE_LIMIT_LOGIN_FAILURES = '5';
process.env.RATE_LIMIT_API_MAX = '100000';
