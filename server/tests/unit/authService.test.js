import { describe, expect, it } from 'vitest';
import {
  TOKEN_TTL_MS,
  changePassword,
  login,
  register,
  signToken,
  verifyToken,
} from '../../src/api/services/authService.js';
import { hashPassword, verifyPassword } from '../../src/api/services/password.js';
import * as usersRepo from '../../src/database/repositories/usersRepo.js';
import { PATIENT } from '../helpers.js';

const newUser = {
  name: 'Ana Torres',
  dob: '1995-03-14',
  email: 'Ana@Example.com',
  password: 'Queue#2026',
  phone: null,
};

describe('passwords', () => {
  it('salts every hash, so the same password hashes differently', () => {
    const a = hashPassword('Queue#2026');
    const b = hashPassword('Queue#2026');
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it('verifies only the right password', () => {
    const { salt, passwordHash } = hashPassword('Queue#2026');
    expect(verifyPassword('Queue#2026', salt, passwordHash)).toBe(true);
    expect(verifyPassword('queue#2026', salt, passwordHash)).toBe(false);
    expect(verifyPassword('Queue#2026', null, null)).toBe(false);
  });
});

describe('register', () => {
  it('creates a patient with a lower-case email and no stored password', () => {
    const user = register(newUser);
    expect(user).toMatchObject({ email: 'ana@example.com', role: 'user' });
    expect(user).not.toHaveProperty('passwordHash');

    const stored = usersRepo.findById(user.id);
    expect(stored.passwordHash).toBeTruthy();
    expect(JSON.stringify(stored)).not.toContain('Queue#2026');
  });

  it('refuses an email that is already registered, ignoring case', () => {
    register(newUser);
    expect(() => register({ ...newUser, email: 'ANA@example.com' })).toThrow(
      expect.objectContaining({ status: 409, code: 'email-taken' })
    );
  });
});

describe('login', () => {
  it('returns a token and the user for the right password', () => {
    const { token, user } = login({ email: PATIENT.email, password: PATIENT.password });
    expect(user.role).toBe('user');
    expect(verifyToken(token).sub).toBe(PATIENT.id);
  });

  it('gives the same 401 for a wrong password and an unknown email', () => {
    const wrong = () => login({ email: PATIENT.email, password: 'Wrong#2026' });
    const unknown = () => login({ email: 'nobody@queuesmart.test', password: 'Wrong#2026' });
    for (const attempt of [wrong, unknown]) {
      expect(attempt).toThrow(
        expect.objectContaining({ status: 401, message: 'Email or password is incorrect.' })
      );
    }
  });

  it('refuses seeded patients that have no password', () => {
    expect(() => login({ email: 'seed1@queuesmart.test', password: 'Anything#1' })).toThrow();
  });
});

describe('tokens', () => {
  it('round-trips the user id and role', () => {
    const payload = verifyToken(signToken({ userId: 'u1', role: 'admin' }));
    expect(payload).toMatchObject({ sub: 'u1', role: 'admin' });
  });

  it('rejects a token whose payload was changed', () => {
    const [, signature] = signToken({ userId: 'u1', role: 'user' }).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'u1', role: 'admin', exp: Date.now() + 1e6 })).toString(
      'base64url'
    );
    expect(verifyToken(`${forged}.${signature}`)).toBeNull();
  });

  it('rejects malformed and expired tokens', () => {
    expect(verifyToken('nonsense')).toBeNull();
    expect(verifyToken(undefined)).toBeNull();
    const issued = Date.now();
    const token = signToken({ userId: 'u1', role: 'user' }, issued);
    expect(verifyToken(token, issued + TOKEN_TTL_MS - 1)).not.toBeNull();
    expect(verifyToken(token, issued + TOKEN_TTL_MS)).toBeNull();
  });
});

describe('changePassword', () => {
  it('replaces the stored hash so the new password works', () => {
    changePassword(PATIENT.id, 'Brand#New2026');
    expect(() => login({ email: PATIENT.email, password: PATIENT.password })).toThrow();
    expect(login({ email: PATIENT.email, password: 'Brand#New2026' }).user.id).toBe(PATIENT.id);
  });

  it('fails for an unknown account', () => {
    expect(() => changePassword('nobody', 'Brand#New2026')).toThrow(
      expect.objectContaining({ status: 404 })
    );
  });
});
