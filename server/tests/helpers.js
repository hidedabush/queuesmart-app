import request from 'supertest';

process.env.JWT_SECRET = 'test-only-secret-for-queuesmart';

const { createApp } = await import('../src/app.js');
import * as db from '../src/database/db.js';

export const app = createApp();

// supertest request against the app, without opening a port.
export const api = () => request(app);

export const validService = (overrides = {}) => ({
  name: 'Allergy Shots',
  description: 'Scheduled allergy injections.',
  expectedDuration: 10,
  priority: 'low',
  capacity: 12,
  ...overrides,
});

// Puts a patient in a line directly in the database. Joining through the API
// belongs to the queue module, which a teammate is building.
export function addToLine(serviceId, status = 'waiting') {
  return db.insert('queueEntries', {
    id: db.nextId('q'),
    userId: 'u-test',
    serviceId,
    reason: 'Test visit',
    status,
    priority: 'normal',
    order: 999,
    arrivedAt: Date.now(),
    calledAt: status === 'called' ? Date.now() : null,
  });
}

// Removes everyone from a line directly in the database.
export function clearLine(serviceId) {
  db.all('queueEntries')
    .filter((entry) => entry.serviceId === serviceId)
    .forEach((entry) => db.remove('queueEntries', entry.id));
}
