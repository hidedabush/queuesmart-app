import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.JWT_SECRET = 'test-only-secret-for-queuesmart';

const { createApp } = await import('../src/app.js');
import * as db from './fakes/db.js';

export const app = createApp();

// supertest request against the app, without opening a port.
export const api = () => request(app);

// A client that sends a bearer token for the given role, as the sign-in
// module would hand out.
export function signedIn(role = 'admin') {
  const token = jwt.sign({ sub: `u-${role}`, role }, process.env.JWT_SECRET);
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (path) => auth(api().get(path)),
    post: (path) => auth(api().post(path)),
    patch: (path) => auth(api().patch(path)),
    delete: (path) => auth(api().delete(path)),
  };
}

export const validService = (overrides = {}) => ({
  name: 'Allergy Shots',
  description: 'Scheduled allergy injections.',
  expectedDuration: 10,
  priority: 'low',
  capacity: 12,
  ...overrides,
});

// Puts a patient in a line directly in the in-memory tables.
export function addToLine(serviceId, status = 'waiting') {
  return db.insert('queueEntries', {
    id: db.nextId('q'),
    serviceId,
    status,
    priority: 'normal',
    order: 999,
    arrivedAt: Date.now(),
    calledAt: status === 'called' ? Date.now() : null,
    leftAt: null,
  });
}

// Removes everyone from a line directly in the in-memory tables.
export function clearLine(serviceId) {
  db.all('queueEntries')
    .filter((entry) => entry.serviceId === serviceId)
    .forEach((entry) => db.remove('queueEntries', entry.id));
}
