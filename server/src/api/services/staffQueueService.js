import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import { AppError, conflict, notFound } from '../errors.js';
import { recordOutcome } from './historyService.js';

// Front desk (staff) side of the queue: docs/A3-api-spec.txt section 5.
//
// STARTER FILE. Only resolveCalled and removeEntry are written, because they
// are where history rows are recorded. getLine, callNext and moveEntry are
// left for the staff-queue implementation owner.

const notImplemented = (what) =>
  new AppError(501, 'not-implemented', `${what} is not built yet.`);

function getServiceOrThrow(serviceId) {
  const service = servicesRepo.findById(serviceId);
  if (!service) throw notFound('This visit type does not exist.');
  return service;
}

// TODO(staff-queue): return the full LineEntry from the spec: patientName and
// dob (from userRepo), displayName ("Maria G."), position, and so on.
function toLineEntry(entry) {
  return {
    id: entry.id,
    userId: entry.userId,
    reason: entry.reason,
    priority: entry.priority,
    status: entry.status,
    order: entry.order,
    arrivedAt: entry.arrivedAt,
    calledAt: entry.calledAt,
  };
}

// GET /services/:id/queue  ->  { called, waiting }
export function getLine(serviceId) {
  getServiceOrThrow(serviceId);
  // TODO(staff-queue)
  throw notImplemented('Viewing the line');
}

// POST /services/:id/queue/call  ->  { called }
// 409 already-calling | empty
export function callNext(serviceId) {
  getServiceOrThrow(serviceId);
  // TODO(staff-queue): set the first waiting entry's status to 'called' and
  // calledAt to Date.now(). History is NOT written here: the patient has not
  // left the line yet.
  throw notImplemented('Calling the next patient');
}

// POST /services/:id/queue/called  { outcome: 'seen' | 'no-show' }  ->  { resolved }
// 409 nothing-called
export function resolveCalled(serviceId, outcome) {
  getServiceOrThrow(serviceId);

  const called = queueRepo.findCalled(serviceId);
  if (!called) throw conflict('nothing-called', 'Nobody is called for this visit type.');

  // HISTORY: keep one recordOutcome call here, BEFORE the entry is removed.
  // If you restructure this function (a helper, a status change instead of
  // a delete, a transaction in A4), keep the rule: call it exactly once, at
  // the moment the entry leaves the line, while its details still exist.
  // Patient cancellations are already recorded in queueService.cancelQueue,
  // so never record the same entry twice.
  recordOutcome(called, outcome);
  queueRepo.remove(called.id);

  return { resolved: toLineEntry(called) };
}

// PATCH /queue/:entryId  { direction: -1 | 1 } or { priority: 'normal' | 'urgent' }
// ->  { waiting }
export function moveEntry(entryId, changes) {
  // TODO(staff-queue): validate `changes`, re-sort, return the new line.
  void entryId;
  void changes;
  throw notImplemented('Reordering the line');
}

// DELETE /queue/:entryId  (204)
export function removeEntry(entryId) {
  const entry = queueRepo.findById(entryId);
  if (!entry) throw notFound('This check-in does not exist.');

  // HISTORY: same rule as in resolveCalled: one recordOutcome call, before
  // the entry is deleted. Keep the 'removed' outcome for staff removals.
  recordOutcome(entry, 'removed');
  queueRepo.remove(entry.id);
}