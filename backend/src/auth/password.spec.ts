import { scryptSync } from 'crypto';
import { hashPassword, requiresPasswordRehash, verifyPassword } from './password';

describe('teacher password hashing', () => {
  it('hashes new passwords with Argon2id and verifies them', async () => {
    const password = 'correct horse battery staple';
    const encoded = await hashPassword(password);

    expect(encoded).toMatch(/^\$argon2id\$/);
    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('different password', encoded)).resolves.toBe(false);
    expect(requiresPasswordRehash(encoded)).toBe(false);
  });

  it('verifies legacy scrypt hashes so successful sign-in can upgrade them', async () => {
    const password = 'correct horse battery staple';
    const salt = Buffer.from('00112233445566778899aabbccddeeff', 'hex');
    const key = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const encoded = `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`;

    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    expect(requiresPasswordRehash(encoded)).toBe(true);
    await expect(verifyPassword('different password', encoded)).resolves.toBe(false);
  });

  it('rejects missing and malformed hashes', async () => {
    await expect(verifyPassword('anything', null)).resolves.toBe(false);
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('anything', '$argon2id$malformed')).resolves.toBe(false);
  });
});
