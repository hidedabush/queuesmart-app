import * as db from '../db.js';

// Test stand-in for src/database/repositories/queueRepo.js.

const inLine = (entry) => ['waiting', 'called'].includes(entry.status);
const byOrder = (a, b) => a.order - b.order;

export async function listByService(serviceId) {
  return db
    .all('queueEntries')
    .filter((entry) => entry.serviceId === serviceId && inLine(entry))
    .sort(byOrder);
}

export async function listWaiting(serviceId) {
  return (await listByService(serviceId)).filter((entry) => entry.status === 'waiting');
}

export async function findCalled(serviceId) {
  return (await listByService(serviceId)).find((entry) => entry.status === 'called') || null;
}

export async function findActiveByUser(userId) {
  return db.all('queueEntries').find((entry) => entry.userId === userId && inLine(entry)) ?? null;
}

export async function findById(entryId) {
  return db.find('queueEntries', entryId);
}

export async function insert(entry) {
  return db.insert('queueEntries', { ...entry, id: db.nextId('q'), leftAt: null });
}

export async function update(entryId, patch) {
  return db.update('queueEntries', entryId, patch);
}

export async function finish(entryId, status, leftAt = Date.now()) {
  db.update('queueEntries', entryId, { status, leftAt });
}
