import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/database/db.js';
import * as authService from '../../src/api/services/authService.js';

const SECRET = 'test-only-secret-for-queuesmart';

// Already validated by the register schema: email lower-cased, dob ISO.
const newPatient = (overrides = {}) => ({
  name: 'Taylor Morgan',
  dob: '1995-03-14',
  email: 'taylor@example.com',
  password: 'Queue#2026',
  ...overrides,
});

const storedUser = (email) => db.all('users').find((user) => user.email === email);

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

describe('register', () => {
  it('creates a patient and never returns or stores the plain password', async () => {
    const { user } = await authService.register(newPatient());

    expect(user).toEqual({
      id: expect.any(String),
      name: 'Taylor Morgan',
      email: 'taylor@example.com',
      dob: '1995-03-14',
      phone: null,
      role: 'user',
    });

    const row = storedUser('taylor@example.com');
    expect(row.passwordHash).toMatch(/^[a-f0-9]+:[a-f0-9]{128}$/);
    expect(row.passwordHash).not.toContain('Queue#2026');
  });

  it('always registers an ordinary user, even if a role is sent', async () => {
    const { user } = await authService.register(newPatient({ role: 'admin' }));

    expect(user.role).toBe('user');
  });

  it('salts every hash, so the same password is stored differently', async () => {
    await authService.register(newPatient({ email: 'a@example.com' }));
    await authService.register(newPatient({ email: 'b@example.com' }));

    expect(storedUser('a@example.com').passwordHash).not.toBe(
      storedUser('b@example.com').passwordHash
    );
  });

  it('rejects an email that is already used, in any letter case', async () => {
    await authService.register(newPatient());

    await expect(
      authService.register(newPatient({ email: 'TAYLOR@example.com' }))
    ).rejects.toMatchObject({ status: 409, code: 'email-taken' });
  });
});

describe('login', () => {
  it('returns a token that carries the user id and role', async () => {
    const { token, user } = await authService.login({
      email: 'admin@queuesmart.test',
      password: 'Admin#2026',
    });

    expect(user).toMatchObject({ id: 'u-admin', role: 'admin' });
    expect(user.passwordHash).toBeUndefined();
    expect(jwt.verify(token, SECRET)).toMatchObject({ sub: 'u-admin', role: 'admin' });
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const expected = { status: 401, code: 'unauthenticated', message: 'Email or password is incorrect.' };

    await expect(
      authService.login({ email: 'patient@queuesmart.test', password: 'Wrong#2026' })
    ).rejects.toMatchObject(expected);
    await expect(
      authService.login({ email: 'nobody@queuesmart.test', password: 'Patient#2026' })
    ).rejects.toMatchObject(expected);
  });

  it('rejects an account that has no password set', async () => {
    // Seeded waiting-room patients have passwordHash: null.
    await expect(
      authService.login({ email: 'seed-patient-1@queuesmart.test', password: 'Anything#1' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([
    ['no salt separator', 'not-a-hash'],
    ['a hash that is not hex', 'salt:zzzz'],
    ['a hash of the wrong length', 'salt:abcd'],
  ])('rejects a stored hash with %s', async (_, passwordHash) => {
    db.update('users', 'u-patient', { passwordHash });

    await expect(
      authService.login({ email: 'patient@queuesmart.test', password: 'Patient#2026' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('fails loudly when the server has no JWT secret', async () => {
    delete process.env.JWT_SECRET;

    await expect(
      authService.login({ email: 'patient@queuesmart.test', password: 'Patient#2026' })
    ).rejects.toThrow('JWT_SECRET must be configured.');
  });
});

describe('getCurrentUser', () => {
  it('returns the public profile', () => {
    const { user } = authService.getCurrentUser('u-patient');

    expect(user).toMatchObject({ id: 'u-patient', email: 'patient@queuesmart.test', role: 'user' });
    expect(user.passwordHash).toBeUndefined();
  });

  it('is a 401 when the account no longer exists', () => {
    expect(() => authService.getCurrentUser('u-gone')).toThrow(
      expect.objectContaining({ status: 401, code: 'unauthenticated' })
    );
  });
});

describe('changePassword', () => {
  it('the new password works and the old one stops working', async () => {
    await authService.changePassword('u-patient', 'Changed#2026');

    await expect(
      authService.login({ email: 'patient@queuesmart.test', password: 'Changed#2026' })
    ).resolves.toHaveProperty('token');
    await expect(
      authService.login({ email: 'patient@queuesmart.test', password: 'Patient#2026' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('is a 401 when the account no longer exists', async () => {
    await expect(authService.changePassword('u-gone', 'Changed#2026')).rejects.toMatchObject({
      status: 401,
    });
  });
});
