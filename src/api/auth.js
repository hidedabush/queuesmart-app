import { request } from './client';

// Authentication API. See docs/A3-api-spec.txt section 3.

// POST /auth/register  { name, dob (MM/DD/YYYY), email, password, phone? }
export async function register(input) {
  return (await request('POST', '/auth/register', input)).user;
}

// POST /auth/login  -> { token, user }
export function login(email, password) {
  return request('POST', '/auth/login', { email, password });
}

// GET /auth/me
export async function getMe() {
  return (await request('GET', '/auth/me')).user;
}

// PATCH /auth/me/password  { password }
export function changePassword(password) {
  return request('PATCH', '/auth/me/password', { password });
}
