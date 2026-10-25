import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/api/errors.js';
import { requireAuth, requireRole } from '../../src/api/middleware/auth.js';

const SECRET = 'test-only-secret-for-queuesmart';

const sign = (payload, options = {}, secret = SECRET) =>
  jwt.sign(payload, secret, { expiresIn: '8h', ...options });

// Just enough of an Express request for the middleware.
function fakeRequest(authorization) {
  return { get: (name) => (name.toLowerCase() === 'authorization' ? authorization : undefined) };
}

// Runs requireAuth and returns what it passed to next(), plus the request.
function runAuth(authorization) {
  const req = fakeRequest(authorization);
  const next = vi.fn();
  requireAuth(req, {}, next);
  expect(next).toHaveBeenCalledTimes(1);
  return { req, passed: next.mock.calls[0][0] };
}

const isUnauthenticated = (passed) =>
  expect(passed).toMatchObject({ status: 401, code: 'unauthenticated' });

beforeEach(() => {
  process.env.JWT_SECRET = SECRET;
});

describe('requireAuth', () => {
  it('sets req.user from a valid token', () => {
    const { req, passed } = runAuth(`Bearer ${sign({ role: 'admin' }, { subject: 'u-admin' })}`);

    expect(passed).toBeUndefined();
    expect(req.user).toEqual({ id: 'u-admin', role: 'admin' });
  });

  it.each([
    ['no header', undefined],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['an empty bearer token', 'Bearer    '],
    ['a token that is not a JWT', 'Bearer not-a-token'],
  ])('rejects %s', (_, authorization) => {
    const { req, passed } = runAuth(authorization);

    isUnauthenticated(passed);
    expect(req.user).toBeUndefined();
  });

  it('rejects a token signed with a different secret', () => {
    const forged = sign({ role: 'admin' }, { subject: 'u-admin' }, 'someone-elses-secret');

    isUnauthenticated(runAuth(`Bearer ${forged}`).passed);
  });

  it('rejects a token whose payload was altered', () => {
    const [header, , signature] = sign({ role: 'user' }, { subject: 'u-patient' }).split('.');
    const payload = Buffer.from(JSON.stringify({ sub: 'u-patient', role: 'admin' })).toString('base64url');

    isUnauthenticated(runAuth(`Bearer ${header}.${payload}.${signature}`).passed);
  });

  it('rejects an expired token', () => {
    vi.useFakeTimers();
    const token = sign({ role: 'user' }, { subject: 'u-patient' });
    vi.setSystemTime(Date.now() + 9 * 60 * 60 * 1000); // 8h lifetime + 1h

    isUnauthenticated(runAuth(`Bearer ${token}`).passed);
  });

  it.each([
    ['no subject', sign({ role: 'user' })],
    ['an unknown role', sign({ role: 'superuser' }, { subject: 'u-patient' })],
    ['a plain-string payload', jwt.sign('u-patient', SECRET)],
  ])('rejects a token with %s', (_, token) => {
    isUnauthenticated(runAuth(`Bearer ${token}`).passed);
  });

  it('reports a missing server secret as a server error, not a bad token', () => {
    const token = sign({ role: 'user' }, { subject: 'u-patient' });
    delete process.env.JWT_SECRET;

    const { passed } = runAuth(`Bearer ${token}`);

    expect(passed).toBeInstanceOf(Error);
    expect(passed).not.toBeInstanceOf(AppError);
    expect(passed.message).toBe('JWT_SECRET must be configured.');
  });
});

describe('requireRole', () => {
  const runRole = (user) => {
    const next = vi.fn();
    requireRole('admin')({ user }, {}, next);
    return next.mock.calls[0][0];
  };

  it('lets the matching role through', () => {
    expect(runRole({ id: 'u-admin', role: 'admin' })).toBeUndefined();
  });

  it('is a 403 for a signed-in user with another role', () => {
    expect(runRole({ id: 'u-patient', role: 'user' })).toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('is a 401 when requireAuth did not run first', () => {
    isUnauthenticated(runRole(undefined));
  });
});
