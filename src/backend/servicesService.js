import * as db from '../database/db';

// Business rules for services. Reads and writes go through src/database/.

export function listServices() {
  return db.all('services');
}

export function getService(id) {
  return db.find('services', id);
}

export function createService(draft) {
  return db.insert('services', {
    ...draft,
    id: `s${Date.now()}`,
    isOpen: true,
    waiting: 0,
  });
}

export function updateService(id, draft) {
  return db.update('services', id, draft);
}

// Deleting a service also removes everyone waiting in its queue.
export function deleteService(id) {
  db.all('queueEntries')
    .filter((entry) => entry.serviceId === id)
    .forEach((entry) => db.remove('queueEntries', entry.id));
  db.remove('services', id);
}

export function setQueueOpen(id, isOpen) {
  return db.update('services', id, { isOpen });
}
