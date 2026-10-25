import * as historyRepo from '../../database/repositories/historyRepo.js';
import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import { conflict, notFound } from '../errors.js';
import { today } from './statsService.js';
import { estimateWait } from './waitEstimate.js';

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

function getEntryOrThrow(entryId) {
  const entry = queueRepo.findById(entryId);

  if (!entry) {
    throw notFound('This patient is no longer in line.');
  }

  return entry;
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

// Staff view of an entry. The patient's name and date of birth come from the
// users table, which the auth teammate adds; until then they are null and
// the front desk screen shows "Patient".
function toLineEntry(entry, position) {
  return {
    id: entry.id,
    userId: entry.userId,
    patientName: null,
    dob: null,
    displayName: null,
    reason: entry.reason,
    priority: entry.priority,
    status: entry.status,
    order: entry.order,
    arrivedAt: entry.arrivedAt,
    calledAt: entry.calledAt,
    position,
  };
}

// Urgent before normal, then arrival order.
function byLineOrder(a, b) {
  if (a.priority !== b.priority) {
    return a.priority === 'urgent' ? -1 : 1;
  }

  return a.order - b.order;
}

function getOrderedPatientLine(serviceId) {
  return queueRepo
    .listByService(serviceId)
    .filter((entry) =>
      ['waiting', 'head-in'].includes(entry.status)
    )
    .sort(byLineOrder);
}

function waitingLine(serviceId) {
  return getOrderedPatientLine(serviceId).map((entry, index) =>
    toLineEntry(entry, index + 1)
  );
}

// Every way out of a line leaves one history row; statistics read them.
function leaveLine(entry, outcome) {
  const service = servicesRepo.findById(entry.serviceId);
  const leftAt = Date.now();

  historyRepo.insert({
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service?.name ?? '',
    date: today(leftAt),
    joinedAt: entry.arrivedAt,
    calledAt: entry.calledAt,
    leftAt,
    outcome,
  });
  queueRepo.remove(entry.id);
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

  leaveLine(entry, 'cancelled');
}


// --- Staff (front desk) ------------------------------------------------------

export function getLine(serviceId) {
  getServiceOrThrow(serviceId);
  const called = queueRepo.findCalled(serviceId);

  return {
    called: called ? toLineEntry(called, 0) : null,
    waiting: waitingLine(serviceId),
  };
}

// Only one patient per line is called at a time.
export function callNext(serviceId) {
  getServiceOrThrow(serviceId);

  if (queueRepo.findCalled(serviceId)) {
    throw conflict(
      'already-calling',
      'A patient is already being called for this line.'
    );
  }

  const [next] = getOrderedPatientLine(serviceId);

  if (!next) {
    throw conflict('empty', 'Nobody is waiting in this line.');
  }

  const called = queueRepo.update(next.id, {
    status: 'called',
    calledAt: Date.now(),
  });

  return { called: toLineEntry(called, 0) };
}

// The called patient reached the desk ("seen") or never arrived ("no-show").
export function resolveCalled(serviceId, outcome) {
  getServiceOrThrow(serviceId);
  const called = queueRepo.findCalled(serviceId);

  if (!called) {
    throw conflict('nothing-called', 'Nobody is being called for this line.');
  }

  leaveLine(called, outcome);

  return { resolved: toLineEntry(called, 0) };
}

// A move only swaps with the neighbour at the same priority, so it can never
// jump an urgent patient. At the edge of a level nothing changes.
function moveWithinLevel(entry, direction) {
  const line = getOrderedPatientLine(entry.serviceId);
  const index = line.findIndex((item) => item.id === entry.id);
  const neighbour = index === -1 ? null : line[index + direction];

  if (!neighbour || neighbour.priority !== entry.priority) return;

  queueRepo.update(entry.id, { order: neighbour.order });
  queueRepo.update(neighbour.id, { order: entry.order });
}

// The schema guarantees exactly one of `direction` or `priority`.
export function updateEntry(entryId, { direction, priority }) {
  const entry = getEntryOrThrow(entryId);

  if (direction !== undefined) {
    moveWithinLevel(entry, direction);
  } else {
    queueRepo.update(entry.id, { priority });
  }

  return { waiting: waitingLine(entry.serviceId) };
}

export function removeEntry(entryId) {
  leaveLine(getEntryOrThrow(entryId), 'removed');
}
