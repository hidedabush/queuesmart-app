
import * as db from '../db.js';

// Read and write queue entries through the shared in-memory database.
// Service management also uses this repository to calculate live counts.

export function listByService(serviceId) {
  return db.all('queueEntries').filter((entry) => entry.serviceId === serviceId);
}

export function listWaiting(serviceId) {
  return listByService(serviceId).filter((entry) => entry.status === 'waiting');
}

export function findCalled(serviceId) {
  return listByService(serviceId).find((entry) => entry.status === 'called') || null;
}

export function listByUser(userId) {
  return db.all('queueEntries').filter((entry) => entry.userId === userId);
}

export function findActiveByUser(userId) {
  return (
    listByUser(userId).find((entry) =>
      ['waiting', 'head-in', 'called'].includes(entry.status)
    ) ?? null
  );
}

export function insert(entry) {
  return db.insert('queueEntries', {
    ...entry,
    id: db.nextId('q'),
  });
}

export function update(entryId, patch) {
  return db.update('queueEntries', entryId, patch);
}

export function remove(entryId) {
  db.remove('queueEntries', entryId);
}

export function findById(entryId) {
  return db.find('queueEntries', entryId);
}
