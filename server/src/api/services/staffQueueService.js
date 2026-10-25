import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import * as userRepo from '../../database/repositories/userRepo.js';
import { conflict, notFound } from '../errors.js';
import { recordOutcome } from './historyService.js';
import { getOrderedPatientLine } from './queueService.js';

// Front desk (staff) side of the queue: docs/A3-api-spec.txt section 5.

function getServiceOrThrow(serviceId) {
  const service = servicesRepo.findById(serviceId);
  if (!service) throw notFound('This visit type does not exist.');
  return service;
}

function getEntryOrThrow(entryId) {
  const entry = queueRepo.findById(entryId);
  if (!entry) throw notFound('This patient is no longer in line.');
  return entry;
}

// Privacy: lists show first name and last initial only ("Maria G.").
function toDisplayName(fullName) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? null;
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// Staff view of an entry, with the patient's name and date of birth so the
// desk can confirm who walks up. position is 0 for the called patient.
function toLineEntry(entry, position) {
  const user = userRepo.findById(entry.userId);

  return {
    id: entry.id,
    userId: entry.userId,
    patientName: user?.name ?? null,
    dob: user?.dob ?? null,
    displayName: toDisplayName(user?.name),
    reason: entry.reason,
    priority: entry.priority,
    status: entry.status,
    order: entry.order,
    arrivedAt: entry.arrivedAt,
    calledAt: entry.calledAt,
    position,
  };
}

function waitingLine(serviceId) {
  return getOrderedPatientLine(serviceId).map((entry, index) =>
    toLineEntry(entry, index + 1)
  );
}

// GET /services/:id/queue  ->  { called, waiting }
export function getLine(serviceId) {
  getServiceOrThrow(serviceId);
  const called = queueRepo.findCalled(serviceId);

  return {
    called: called ? toLineEntry(called, 0) : null,
    waiting: waitingLine(serviceId),
  };
}

// POST /services/:id/queue/call  ->  { called }
// 409 already-calling | empty. Only one patient per line is called at a time.
// History is NOT written here: the patient has not left the line yet.
export function callNext(serviceId) {
  getServiceOrThrow(serviceId);

  if (queueRepo.findCalled(serviceId)) {
    throw conflict('already-calling', 'A patient is already being called for this line.');
  }

  const [next] = getOrderedPatientLine(serviceId);
  if (!next) throw conflict('empty', 'Nobody is waiting in this line.');

  const called = queueRepo.update(next.id, { status: 'called', calledAt: Date.now() });

  return { called: toLineEntry(called, 0) };
}

// POST /services/:id/queue/called  { outcome: 'seen' | 'no-show' }  ->  { resolved }
// 409 nothing-called
export function resolveCalled(serviceId, outcome) {
  getServiceOrThrow(serviceId);

  const called = queueRepo.findCalled(serviceId);
  if (!called) throw conflict('nothing-called', 'Nobody is being called for this line.');

  // HISTORY: one recordOutcome call, BEFORE the entry is removed, while its
  // details still exist. Patient cancellations are recorded in
  // queueService.cancelQueue, so never record the same entry twice.
  recordOutcome(called, outcome);
  queueRepo.remove(called.id);

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

// PATCH /queue/:entryId  { direction: -1 | 1 } or { priority: 'normal' | 'urgent' }
// ->  { waiting }. The entryUpdate schema guarantees exactly one of the two.
export function moveEntry(entryId, { direction, priority }) {
  const entry = getEntryOrThrow(entryId);

  if (direction !== undefined) {
    moveWithinLevel(entry, direction);
  } else {
    queueRepo.update(entry.id, { priority });
  }

  return { waiting: waitingLine(entry.serviceId) };
}

// DELETE /queue/:entryId  (204)
export function removeEntry(entryId) {
  const entry = getEntryOrThrow(entryId);

  // HISTORY: same rule as in resolveCalled. Staff removals are 'removed'.
  recordOutcome(entry, 'removed');
  queueRepo.remove(entry.id);
}
