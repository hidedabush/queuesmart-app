import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import { conflict, notFound } from '../errors.js';
import { closeForEntry, notifyJoined, notifyLineChanged } from '../notifications/notificationService.js';
import { recordOutcome } from './historyService.js';
import { estimateWait } from './waitEstimate.js';

// Patient side of the queue. The front desk side (staffQueueService.js)
// reuses getOrderedPatientLine so both see the same order.

// A patient may have only one active queue entry across all visit types.
function findActiveEntry(userId) {
  return queueRepo.findActiveByUser(userId);
}

async function getServiceOrThrow(serviceId) {
  const service = await servicesRepo.findById(serviceId);

  if (!service) {
    throw notFound('This visit type does not exist.');
  }

  return service;
}

function toMyEntry(entry, service, position, peopleAhead, estimatedWait) {
  return {
    id: entry.id,
    serviceId: entry.serviceId,
    serviceName: service.name,
    reason: entry.reason,
    priority: entry.priority,
    status: entry.status,
    position,
    peopleAhead,
    estimatedWait,
    arrivedAt: entry.arrivedAt,
    calledAt: entry.calledAt,
  };
}

// Urgent before normal, then arrival order.
export function byLineOrder(a, b) {
  if (a.priority !== b.priority) {
    return a.priority === 'urgent' ? -1 : 1;
  }

  return a.order - b.order;
}

// Everyone still waiting (not called) for one visit type, in serving order.
export async function getOrderedPatientLine(serviceId) {
  const entries = await queueRepo.listWaiting(serviceId);

  return entries.sort(byLineOrder);
}

// Status a queue entry ends with, for each history outcome.
const LEFT_STATUS = {
  seen: 'served',
  'no-show': 'no-show',
  cancelled: 'canceled',
  removed: 'removed',
};

// Every way out of a line: cancelQueue (patient), resolveCalled and
// removeEntry (front desk). The history row copies the entry's details, the
// entry is kept with its final status, and its unread notices are closed.
export async function leaveLine(entry, outcome) {
  await recordOutcome(entry, outcome);
  await queueRepo.finish(entry.id, LEFT_STATUS[outcome]);
  await closeForEntry(entry.id);
}

// queue.changed (docs/A3-api-spec.txt section 5): tell anyone now near the
// front of this line to head to the office.
export async function announceLineChange(serviceId) {
  const service = await servicesRepo.findById(serviceId);
  if (!service) return;
  await notifyLineChanged(service, await getOrderedPatientLine(serviceId));
}

export async function joinQueue(userId, serviceId, reason) {
  if (await findActiveEntry(userId)) {
    throw conflict(
      'already-checked-in',
      'You already have an active check-in.'
    );
  }

  const service = await getServiceOrThrow(serviceId);

  if (!service.isOpen) {
    throw conflict(
      'closed',
      'This visit type is not accepting new check-ins.'
    );
  }

  const existingEntries = await queueRepo.listByService(serviceId);

  if (existingEntries.length >= service.capacity) {
    throw conflict(
      'full',
      'This visit type has reached its check-in capacity.'
    );
  }

  const lineBeforeJoin = await getOrderedPatientLine(serviceId);
  const nextOrder =
    existingEntries.reduce(
      (highest, entry) => Math.max(highest, entry.order ?? 0),
      0
    ) + 1;

  const entry = await queueRepo.insert({
    userId,
    serviceId,
    reason: reason.trim(),
    status: 'waiting',
    priority: 'normal',
    order: nextOrder,
    arrivedAt: Date.now(),
    calledAt: null,
  });

  const orderedAfterJoin = [...lineBeforeJoin, entry].sort(byLineOrder);

  const position =
    orderedAfterJoin.findIndex((item) => item.id === entry.id) + 1;

  const peopleAhead = position - 1;
  const estimatedWait = estimateWait(service, peopleAhead);

  await notifyJoined(entry, service, position, estimatedWait);
  await announceLineChange(serviceId);

  return {
    entry: toMyEntry(
      entry,
      service,
      position,
      peopleAhead,
      estimatedWait
    ),
  };
}


export async function getMyQueue(userId) {
  const entry = await findActiveEntry(userId);

  if (!entry) {
    return null;
  }

  const service = await getServiceOrThrow(entry.serviceId);

  if (entry.status === 'called') {
    return {
      entry: toMyEntry(entry, service, 0, 0, null),
    };
  }

  const orderedLine = await getOrderedPatientLine(entry.serviceId);
  const index = orderedLine.findIndex(
    (item) => item.id === entry.id
  );

  // An active non-called entry should be present in the line.
  if (index === -1) {
    throw new Error(
      'Active queue entry was not found in the ordered line.'
    );
  }

  const position = index + 1;
  const peopleAhead = position - 1;
  const estimatedWait = estimateWait(service, peopleAhead);

  return {
    entry: toMyEntry(
      entry,
      service,
      position,
      peopleAhead,
      estimatedWait
    ),
  };
}


export async function cancelQueue(userId) {
  const entry = await findActiveEntry(userId);

  if (!entry) {
    throw notFound('You do not have an active check-in to cancel.');
  }

  await leaveLine(entry, 'cancelled');
  await announceLineChange(entry.serviceId);
}
