import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Passwords are never stored. We keep a random salt and the scrypt hash of
// salt + password, and compare hashes in constant time.

const KEY_LENGTH = 64;

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const passwordHash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return { salt, passwordHash };
}

export function verifyPassword(password, salt, passwordHash) {
  if (!salt || !passwordHash) return false;
  const expected = Buffer.from(passwordHash, 'hex');
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
