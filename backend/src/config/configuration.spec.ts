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
    expect(c.webauthn.rpId).toBe('data-entry-portal-dusky.vercel.app');
  });
  it('makes cookies Secure by default in production', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).cookieSecure).toBe(true);
  });
  it('enables SSL for Neon PostgreSQL URLs', () => {
    expect(loadConfig({ ...base, DATABASE_URL: 'postgresql://user:password@ep.example.neon.tech/db?sslmode=require' }).databaseSsl).toBe(true);
  });
  it('allows the deployed frontend origin in addition to configured origins', () => {
    const config = loadConfig({ ...base, CORS_ORIGINS: 'https://school.example' });
    expect(config.corsOrigins).toEqual([
      'https://school.example',
      'https://data-entry-portal-dusky.vercel.app',
    ]);
    expect(config.webauthn.rpId).toBe('school.example');
    expect(config.webauthn.origins).toEqual([
      'https://school.example',
      'https://data-entry-portal-dusky.vercel.app',
    ]);
  });
  it('allows an explicit WebAuthn relying-party ID for custom domain deployments', () => {
    expect(loadConfig({ ...base, WEBAUTHN_RP_ID: 'school.example' }).webauthn.rpId).toBe('school.example');
    expect(() => loadConfig({ ...base, WEBAUTHN_RP_ID: 'https://school.example' })).toThrow(/WEBAUTHN_RP_ID/);
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
