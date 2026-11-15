import { loadConfig } from './configuration';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  SESSION_SECRET: 'x'.repeat(40),
};

describe('loadConfig', () => {
  it('loads with safe defaults', () => {
    const c = loadConfig(base);
    expect(c.port).toBe(3000);
    expect(c.cookieSecure).toBe(false);
    expect(c.session.teacherTtlSeconds).toBe(8 * 3600);
    expect(c.school.name).toBe('Noradin Boys Secondary School');
  });
  it('makes cookies Secure by default in production', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).cookieSecure).toBe(true);
  });
  it('enables SSL for Neon PostgreSQL URLs', () => {
    expect(loadConfig({ ...base, DATABASE_URL: 'postgresql://user:password@ep.example.neon.tech/db?sslmode=require' }).databaseSsl).toBe(true);
  });
  it('fails fast on a short or example session secret', () => {
    expect(() => loadConfig({ ...base, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SESSION_SECRET: 'change-me-' + 'x'.repeat(30) })).toThrow(/example value/);
  });
  it('fails fast on bad connection strings and numbers', () => {
    expect(() => loadConfig({ ...base, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });
});
