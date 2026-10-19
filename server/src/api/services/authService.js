import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import * as usersRepo from '../../database/repositories/usersRepo.js';
import { conflict, notFound, unauthenticated } from '../errors.js';
import { hashPassword, verifyPassword } from './password.js';

/**
 * Authentication module: registration, login, roles.
 *
 * Login returns a signed token instead of storing a session, so the database
 * keeps only the four A1 tables. A token is
 *   base64url({ sub: userId, role, exp }) + "." + HMAC-SHA256 signature
 * and is good for 8 hours. The secret is random per server start unless
 * TOKEN_SECRET is set; data is in memory anyway, so a restart signs
 * everyone out along with resetting everything else.
 */

export const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const SECRET = process.env.TOKEN_SECRET || randomBytes(32).toString('hex');

function sign(payload) {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function signToken({ userId, role }, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, role, exp: now + TOKEN_TTL_MS })).toString(
    'base64url'
  );
  return `${payload}.${sign(payload)}`;
}

// The token's payload if it is genuine and not expired, otherwise null.
export function verifyToken(token, now = Date.now()) {
  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > now ? data : null;
  } catch {
    return null;
  }
}

// What the API ever shows about a user: never the hash or salt.
export function publicUser(user) {
  const { id, name, email, dob, phone, role } = user;
  return { id, name, email, dob, phone, role };
}

// Registration always creates a patient. Staff accounts come from the seed.
export function register({ name, dob, email, password, phone }) {
  if (usersRepo.findByEmail(email)) {
    throw conflict('email-taken', 'An account with this email already exists.');
  }
  const user = usersRepo.insert({
    name,
    dob,
    email: email.toLowerCase(),
    phone: phone ?? null,
    ...hashPassword(password),
    role: 'user',
    createdAt: Date.now(),
  });
  return publicUser(user);
}

// Same message for an unknown email and a wrong password, so the response
// never reveals which emails have accounts.
export function login({ email, password }) {
  const user = usersRepo.findByEmail(email);
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    throw unauthenticated('Email or password is incorrect.');
  }
  return { token: signToken({ userId: user.id, role: user.role }), user: publicUser(user) };
}

export function changePassword(userId, password) {
  if (!usersRepo.findById(userId)) throw notFound('Account not found.');
  usersRepo.update(userId, hashPassword(password));
}
