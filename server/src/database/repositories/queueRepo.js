import * as db from '../db.js';

// Queue entries table. Rows come back unsorted: line order is a business
// rule and lives in api/services/queueService.js.

export function findById(id) {
  return db.find('queueEntries', id);
}

export function listByService(serviceId) {
  return db.all('queueEntries').filter((entry) => entry.serviceId === serviceId);
}

export function listWaiting(serviceId) {
  return listByService(serviceId).filter((entry) => entry.status === 'waiting');
}

export function findCalled(serviceId) {
  return listByService(serviceId).find((entry) => entry.status === 'called') || null;
}

// A patient can be in one line at a time, so there is at most one row.
export function findActiveByUser(userId) {
  return db.all('queueEntries').find((entry) => entry.userId === userId) || null;
}

// Arrival sequence across the whole office.
export function nextOrder() {
  return db.all('queueEntries').reduce((max, entry) => Math.max(max, entry.order), 0) + 1;
}

export function insert(entry) {
  return db.insert('queueEntries', { ...entry, id: db.nextId('q') });
}

export function update(id, patch) {
  return db.update('queueEntries', id, patch);
}

export function remove(id) {
  db.remove('queueEntries', id);
}
