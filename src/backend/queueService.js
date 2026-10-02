import * as db from '../database/db';
import { waitRange } from './waitEstimate';

// Business rules for the user's place in a queue. A2 has a single user, so
// there is at most one entry: the queue they are currently in.

export function getActiveQueue() {
  return db.all('queueEntries')[0] || null;
}

// Joining goes to the back of the line and counts towards the service's
// waiting total, so the admin dashboard sees the same queue the user does.
export function joinQueue(serviceId) {
  const service = db.find('services', serviceId);
  if (!service || !service.isOpen) return null;

  // One queue at a time: joining a new one gives up the old place.
  leaveQueue();

  const position = service.waiting + 1;
  const entry = db.insert('queueEntries', {
    id: `q${Date.now()}`,
    serviceId,
    position,
    estimatedWait: waitRange(position, service.expectedDuration),
    status: 'waiting',
  });
  db.update('services', serviceId, { waiting: position });
  return entry;
}

export function leaveQueue() {
  const entry = getActiveQueue();
  if (!entry) return;

  const service = db.find('services', entry.serviceId);
  if (service) {
    db.update('services', service.id, { waiting: Math.max(0, service.waiting - 1) });
  }
  db.remove('queueEntries', entry.id);
}
