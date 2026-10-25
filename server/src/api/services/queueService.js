import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import { conflict, notFound } from '../errors.js';
import { recordOutcome } from './historyService.js';
import { estimateWait } from './waitEstimate.js';

// Patient side of the queue. The front desk side (staffQueueService.js)
// reuses getOrderedPatientLine so both see the same order.

// A patient may have only one active queue entry across all visit types.
function findActiveEntry(userId) {
  return queueRepo.findActiveByUser(userId);
}

function getServiceOrThrow(serviceId) {
  const service = servicesRepo.findById(serviceId);

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
export function getOrderedPatientLine(serviceId) {
  return queueRepo
    .listByService(serviceId)
    .filter((entry) =>
      ['waiting', 'head-in'].includes(entry.status)
    )
    .sort(byLineOrder);
}

export function joinQueue(userId, serviceId, reason) {
  if (findActiveEntry(userId)) {
    throw conflict(
      'already-checked-in',
      'You already have an active check-in.'
    );
  }

  const service = getServiceOrThrow(serviceId);

  if (!service.isOpen) {
    throw conflict(
      'closed',
      'This visit type is not accepting new check-ins.'
    );
  }

  const existingEntries = queueRepo.listByService(serviceId);

  if (existingEntries.length >= service.capacity) {
    throw conflict(
      'full',
      'This visit type has reached its check-in capacity.'
    );
  }

  const lineBeforeJoin = getOrderedPatientLine(serviceId);
  const nextOrder =
    existingEntries.reduce(
      (highest, entry) => Math.max(highest, entry.order ?? 0),
      0
    ) + 1;

  const entry = queueRepo.insert({
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


export function getMyQueue(userId) {
  const entry = findActiveEntry(userId);

  if (!entry) {
    return null;
  }

  const service = getServiceOrThrow(entry.serviceId);

  if (entry.status === 'called') {
    return {
      entry: toMyEntry(entry, service, 0, 0, null),
    };
  }

  const orderedLine = getOrderedPatientLine(entry.serviceId);
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


export function cancelQueue(userId) {
  const entry = findActiveEntry(userId);

  if (!entry) {
    throw notFound('You do not have an active check-in to cancel.');
  }

  // Row is written before the entry is removed so the row can copy its details.
  recordOutcome(entry, 'cancelled');

  queueRepo.remove(entry.id);
}
