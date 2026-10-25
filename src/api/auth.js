import { request } from './client';

/**
 * Auth API (docs/A3-api-spec.txt section 3). Login returns { token, user };
 * the store keeps the token via setAuthToken in client.js. Signing out is
 * client-side only.
 */

// POST /auth/register  { name, dob (MM/DD/YYYY), email, password, phone? }
export async function register(draft) {
  return (await request('POST', '/auth/register', draft)).user;
}

// POST /auth/login  { email, password }  ->  { token, user }
export function login(credentials) {
  return request('POST', '/auth/login', credentials);
}

// GET /auth/me
export async function getMe() {
  return (await request('GET', '/auth/me')).user;
}

// PATCH /auth/me/password  { password }  (204)
export async function changePassword(password) {
  await request('PATCH', '/auth/me/password', { password });
  return {};
}