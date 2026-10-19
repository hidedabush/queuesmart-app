import request from 'supertest';
import { createApp } from '../src/app.js';
import { DEMO_ADMIN, DEMO_PATIENT } from '../src/database/seed.js';
import { signToken } from '../src/api/services/authService.js';

export const app = createApp();

// Tokens for the seeded accounts, signed directly (no slow password hash).
export const adminToken = () => signToken({ userId: 'u-admin', role: 'admin' });
export const patientToken = () => signToken({ userId: 'u-patient', role: 'user' });

export const ADMIN = { id: 'u-admin', ...DEMO_ADMIN };
export const PATIENT = { id: 'u-patient', ...DEMO_PATIENT };

// supertest request with the Bearer header already set.
export function as(token) {
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (path) => auth(request(app).get(path)),
    post: (path) => auth(request(app).post(path)),
    patch: (path) => auth(request(app).patch(path)),
    delete: (path) => auth(request(app).delete(path)),
  };
}

export const anon = () => request(app);

export const validService = (overrides = {}) => ({
  name: 'Allergy Shots',
  description: 'Scheduled allergy injections.',
  expectedDuration: 10,
  priority: 'low',
  capacity: 12,
  ...overrides,
});
