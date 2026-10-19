import * as db from '../db.js';

// Queue entries table, read-only. Service management uses it to count who
// is in each line. Joining, leaving and serving belong to the queue module
// (queue teammate), which adds the write functions here.

export function listByService(serviceId) {
  return db.all('queueEntries').filter((entry) => entry.serviceId === serviceId);
}

export function listWaiting(serviceId) {
  return listByService(serviceId).filter((entry) => entry.status === 'waiting');
}

export function findCalled(serviceId) {
  return listByService(serviceId).find((entry) => entry.status === 'called') || null;
}
