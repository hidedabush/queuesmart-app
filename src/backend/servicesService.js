import * as db from '../database/db';
import { DEFAULT_CAPACITY } from './officeRules';
import { countWaiting, getCalled } from './queueService';

// Business rules for visit types. Reads and writes go through src/database/.
// `waiting` is counted from the waiting room rather than stored, so it can
// never drift from the actual line.

function withLine(service) {
  return {
    ...service,
    capacity: service.capacity ?? DEFAULT_CAPACITY,
    waiting: countWaiting(service.id),
    hasCalled: Boolean(getCalled(service.id)),
  };
}

export function listServices() {
  return db.all('services').map(withLine);
}

export function getService(id) {
  const service = db.find('services', id);
  return service ? withLine(service) : null;
}

export function createService(draft) {
  return db.insert('services', {
    capacity: DEFAULT_CAPACITY,
    ...draft,
    id: `s${Date.now()}`,
    isOpen: true,
  });
}

export function updateService(id, draft) {
  return db.update('services', id, draft);
}

// Patients are never dropped silently: a visit type can only be deleted once
// its line is empty. Close it first and let the line clear.
export function deleteService(id) {
  const inLine = db.all('queueEntries').some((entry) => entry.serviceId === id);
  if (inLine) return { error: 'patients-in-line' };
  db.remove('services', id);
  return {};
}

// Closing stops new check-ins only; patients already in line keep their place.
export function setQueueOpen(id, isOpen) {
  return db.update('services', id, { isOpen });
}
