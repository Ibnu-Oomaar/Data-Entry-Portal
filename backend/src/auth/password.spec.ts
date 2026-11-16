import { hashPassword, verifyPassword } from './password';

describe('teacher password hashing', () => {
  it('verifies the correct password without storing it in the encoded value', async () => {
    const password = 'correct horse battery staple';
    const encoded = await hashPassword(password);

    expect(encoded).not.toContain(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword('different password', encoded)).resolves.toBe(false);
  });

  it('rejects missing and malformed hashes', async () => {
    await expect(verifyPassword('anything', null)).resolves.toBe(false);
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });
});
