import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import * as usersRepo from '../../database/repositories/usersRepo.js';
import * as notifications from '../../notifications/index.js';
import { conflict, notFound } from '../errors.js';
import * as history from './historyService.js';
import { checkInBlocker, displayName, patientStatus } from './officeRules.js';
import { waitRange } from './waitEstimate.js';

/**
 * Queue management module. Each visit type has one line. An entry is
 * 'waiting' until the front desk calls it, then 'called' until staff mark
 * the patient seen or a no-show; any exit writes a history row.
 *
 * Line order considers priority, then arrival:
 *   1. urgent before normal (staff triage a patient to urgent)
 *   2. `order` ascending (arrival sequence; staff can swap neighbours)
 */
const PRIORITY_RANK = { urgent: 0, normal: 1 };

export function compareEntries(a, b) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order;
}

// Waiting patients for one visit type, in the order they will be called.
export function listLine(serviceId) {
  return queueRepo.listWaiting(serviceId).sort(compareEntries);
}

function findServiceOrThrow(serviceId) {
  const service = servicesRepo.findById(serviceId);
  if (!service) throw notFound('This visit type does not exist.');
  return service;
}

function recipientFor(entry) {
  const user = usersRepo.findById(entry.userId);
  return { userId: entry.userId, phone: user?.phone ?? null };
}

// Tell the Notification component the line moved; it decides who to alert.
function afterLineChange(serviceId) {
  const service = servicesRepo.findById(serviceId);
  if (!service) return;
  notifications.trigger({
    type: 'line-changed',
    serviceName: service.name,
    line: listLine(serviceId).map((entry, index) => ({
      entry,
      recipient: recipientFor(entry),
      peopleAhead: index,
    })),
  });
}

// --- Patient --------------------------------------------------------------

// The signed-in patient's check-in with their live place in line, or null.
export function getMyEntry(userId) {
  const entry = queueRepo.findActiveByUser(userId);
  if (!entry) return null;

  const service = servicesRepo.findById(entry.serviceId);
  const isCalled = entry.status === 'called';
  const peopleAhead = isCalled ? 0 : listLine(entry.serviceId).findIndex((e) => e.id === entry.id);

  return {
    id: entry.id,
    serviceId: entry.serviceId,
    serviceName: service?.name ?? 'Visit',
    reason: entry.reason,
    priority: entry.priority,
    status: patientStatus(entry, peopleAhead),
    position: isCalled ? 0 : peopleAhead + 1,
    peopleAhead,
    estimatedWait: waitRange(peopleAhead, service?.expectedDuration ?? 0),
    arrivedAt: entry.arrivedAt,
    calledAt: entry.calledAt,
  };
}

const BLOCKER_MESSAGES = {
  'already-checked-in': 'You are already checked in. Cancel that check-in to choose a different visit type.',
  closed: 'This visit type is not taking walk-ins right now.',
  full: 'This line is full for today.',
};

export function join(user, serviceId, reason) {
  const service = findServiceOrThrow(serviceId);
  const blocker = checkInBlocker(
    service,
    queueRepo.listWaiting(serviceId).length,
    Boolean(queueRepo.findActiveByUser(user.id))
  );
  if (blocker) throw conflict(blocker, BLOCKER_MESSAGES[blocker]);

  const entry = queueRepo.insert({
    userId: user.id,
    serviceId,
    reason,
    status: 'waiting',
    priority: 'normal',
    order: queueRepo.nextOrder(),
    arrivedAt: Date.now(),
    calledAt: null,
  });

  const mine = getMyEntry(user.id);
  notifications.trigger({
    type: 'joined',
    serviceName: service.name,
    entry,
    recipient: recipientFor(entry),
    position: mine.position,
    estimatedWait: mine.estimatedWait,
  });
  afterLineChange(serviceId);
  return mine;
}

// The patient cancels their own check-in.
export function leave(userId) {
  const entry = queueRepo.findActiveByUser(userId);
  if (!entry) throw notFound('You are not checked in.');
  queueRepo.remove(entry.id);
  history.record(entry, 'cancelled');
  afterLineChange(entry.serviceId);
}

// --- Front desk -----------------------------------------------------------

// What staff see for one entry. Staff need the full name and date of birth
// to confirm identity at the desk; `displayName` is for on-screen lists.
function staffView(entry, position) {
  const user = usersRepo.findById(entry.userId);
  return {
    id: entry.id,
    userId: entry.userId,
    patientName: user?.name ?? 'Patient',
    displayName: displayName(user?.name),
    dob: user?.dob ?? null,
    reason: entry.reason,
    priority: entry.priority,
    status: entry.status,
    order: entry.order,
    position,
    arrivedAt: entry.arrivedAt,
    calledAt: entry.calledAt,
  };
}

export function getLineForStaff(serviceId) {
  findServiceOrThrow(serviceId);
  const called = queueRepo.findCalled(serviceId);
  return {
    called: called ? staffView(called, 0) : null,
    waiting: listLine(serviceId).map((entry, index) => staffView(entry, index + 1)),
  };
}

/**
 * Serve next: call the first patient in line. Only one patient per line can
 * be called at a time, so nobody is double-called while staff are still
 * waiting for the last person to reach the desk.
 */
export function callNext(serviceId) {
  const service = findServiceOrThrow(serviceId);
  if (queueRepo.findCalled(serviceId)) {
    throw conflict('already-calling', 'Finish with the patient being called first.');
  }
  const [next] = listLine(serviceId);
  if (!next) throw conflict('empty', 'Nobody is waiting in this line.');

  const called = queueRepo.update(next.id, { status: 'called', calledAt: Date.now() });
  notifications.trigger({
    type: 'called',
    serviceName: service.name,
    entry: called,
    recipient: recipientFor(called),
  });
  afterLineChange(serviceId);
  return staffView(called, 0);
}

// The called patient arrived ('seen') or did not ('no-show').
export function resolveCalled(serviceId, outcome) {
  findServiceOrThrow(serviceId);
  const called = queueRepo.findCalled(serviceId);
  if (!called) throw conflict('nothing-called', 'Nobody is being called in this line.');
  const view = staffView(called, 0);
  queueRepo.remove(called.id);
  history.record(called, outcome);
  return view;
}

function findEntryOrThrow(entryId) {
  const entry = queueRepo.findById(entryId);
  if (!entry) throw notFound('This patient is no longer in line.');
  return entry;
}

/**
 * Staff change one waiting entry: move it one place (direction -1 / +1,
 * only past someone with the same priority) or triage it (priority).
 * Returns the re-sorted line.
 */
export function updateEntry(entryId, { direction, priority }) {
  const entry = findEntryOrThrow(entryId);

  if (priority !== undefined && entry.status === 'waiting') {
    queueRepo.update(entry.id, { priority });
  }

  if (direction !== undefined && entry.status === 'waiting') {
    const line = listLine(entry.serviceId);
    const index = line.findIndex((e) => e.id === entry.id);
    const target = line[index + direction];
    if (target && target.priority === entry.priority) {
      queueRepo.update(entry.id, { order: target.order });
      queueRepo.update(target.id, { order: entry.order });
    }
  }

  afterLineChange(entry.serviceId);
  return getLineForStaff(entry.serviceId).waiting;
}

// Take a patient out of line (left the office, duplicate, etc.).
export function removeEntry(entryId) {
  const entry = findEntryOrThrow(entryId);
  queueRepo.remove(entry.id);
  history.record(entry, 'removed');
  afterLineChange(entry.serviceId);
}
