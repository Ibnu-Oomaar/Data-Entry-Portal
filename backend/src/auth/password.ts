import { scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import argon2 from 'argon2';

const ARGON2_MEMORY_COST = 19_456;
const ARGON2_TIME_COST = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;
const ARGON2_HASH_PATTERN = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;

const LEGACY_KEY_LENGTH = 64;
const LEGACY_COST = 16_384;
const LEGACY_BLOCK_SIZE = 8;
const LEGACY_PARALLELIZATION = 1;
const LEGACY_MAX_MEMORY = 64 * 1024 * 1024;
const LEGACY_SCRYPT_PATTERN = /^scrypt\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/i;

function deriveLegacyKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      LEGACY_KEY_LENGTH,
      { N: LEGACY_COST, r: LEGACY_BLOCK_SIZE, p: LEGACY_PARALLELIZATION, maxmem: LEGACY_MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: ARGON2_MEMORY_COST,
    timeCost: ARGON2_TIME_COST,
    parallelism: ARGON2_PARALLELISM,
    hashLength: ARGON2_HASH_LENGTH,
  });
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  if (!encoded) return false;
  if (ARGON2_HASH_PATTERN.test(encoded)) {
    return argon2.verify(encoded, password);
  }

  if (!LEGACY_SCRYPT_PATTERN.test(encoded)) return false;
  const [, , , , saltHex, keyHex] = encoded.split('$');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await deriveLegacyKey(password, salt);
  return timingSafeEqual(actual, expected);
}

export function requiresPasswordRehash(encoded: string | null): boolean {
  return encoded !== null && LEGACY_SCRYPT_PATTERN.test(encoded);
}
