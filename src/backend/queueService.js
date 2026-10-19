import * as db from '../database/db';
import { checkInBlocker, patientStatus, validateReason } from './officeRules';
import { waitRange } from './waitEstimate';

// Business rules for the waiting room. Every patient in line is a row in
// queueEntries; the signed-in patient's row has isCurrentUser set. A row is
// 'waiting' until the front desk calls it, then 'called' until staff mark the
// patient checked in or a no-show, which removes it from the line.

function byOrder(a, b) {
  return a.order - b.order;
}

// The patients still waiting for one visit type, in line order.
export function listQueue(serviceId) {
  return db
    .all('queueEntries')
    .filter((entry) => entry.serviceId === serviceId && entry.status === 'waiting')
    .sort(byOrder);
}

// The patient the front desk has called for this visit type, if any.
export function getCalled(serviceId) {
  return (
    db.all('queueEntries').find((entry) => entry.serviceId === serviceId && entry.status === 'called') ||
    null
  );
}

export function countWaiting(serviceId) {
  return listQueue(serviceId).length;
}

function currentEntry() {
  return db.all('queueEntries').find((entry) => entry.isCurrentUser) || null;
}

// The signed-in patient's check-in, with their live place in line.
export function getActiveQueue() {
  const entry = currentEntry();
  if (!entry) return null;

  const service = db.find('services', entry.serviceId);
  const line = listQueue(entry.serviceId);
  const peopleAhead = entry.status === 'called' ? 0 : line.findIndex((e) => e.id === entry.id);

  return {
    ...entry,
    position: entry.status === 'called' ? 0 : peopleAhead + 1,
    peopleAhead,
    estimatedWait: waitRange(peopleAhead, service?.expectedDuration ?? 0),
    status: patientStatus(entry, peopleAhead),
  };
}

function nextOrder() {
  return db.all('queueEntries').reduce((max, entry) => Math.max(max, entry.order), 0) + 1;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function recordVisit(entry, outcome) {
  const service = db.find('services', entry.serviceId);
  db.insert('visitHistory', {
    id: `h${Date.now()}`,
    serviceName: service?.name ?? 'Visit',
    date: today(),
    outcome,
  });
}

/**
 * Checks the signed-in patient in for a visit type.
 * Returns { entry } on success or { error } naming the rule that blocked it.
 */
export function checkIn(serviceId, patient, reason) {
  const service = db.find('services', serviceId);
  const blocker = checkInBlocker(service, countWaiting(serviceId), Boolean(currentEntry()));
  if (blocker) return { error: blocker };

  const reasonError = validateReason(reason);
  if (reasonError) return { error: 'reason', message: reasonError };

  const entry = db.insert('queueEntries', {
    id: `q${Date.now()}`,
    serviceId,
    patientName: patient.name,
    dob: patient.dob,
    reason: reason.trim(),
    status: 'waiting',
    order: nextOrder(),
    isCurrentUser: true,
  });
  return { entry };
}

// The patient cancels their own check-in.
export function cancelCheckIn() {
  const entry = currentEntry();
  if (!entry) return;
  db.remove('queueEntries', entry.id);
  recordVisit(entry, 'cancelled');
}

/**
 * Front desk: call the first waiting patient. Only one patient per visit
 * type can be called at a time, so nobody is double-called while staff are
 * still waiting for the last person to arrive.
 */
export function callNext(serviceId) {
  if (getCalled(serviceId)) return { error: 'already-calling' };
  const [next] = listQueue(serviceId);
  if (!next) return { error: 'empty' };
  return { entry: db.update('queueEntries', next.id, { status: 'called', calledAt: Date.now() }) };
}

// Front desk: the called patient arrived ('seen') or did not ('no-show').
export function resolveCalled(serviceId, outcome) {
  const called = getCalled(serviceId);
  if (!called) return null;
  db.remove('queueEntries', called.id);
  if (called.isCurrentUser) recordVisit(called, outcome);
  return called;
}

// Front desk: swap a waiting patient with the one above (-1) or below (+1).
export function moveEntry(serviceId, entryId, direction) {
  const line = listQueue(serviceId);
  const index = line.findIndex((entry) => entry.id === entryId);
  const target = line[index + direction];
  if (index < 0 || !target) return;
  db.update('queueEntries', entryId, { order: target.order });
  db.update('queueEntries', target.id, { order: line[index].order });
}

// Front desk: take a patient out of line (left the office, duplicate, etc.).
export function removeEntry(entryId) {
  const entry = db.find('queueEntries', entryId);
  if (!entry) return;
  db.remove('queueEntries', entryId);
  if (entry.isCurrentUser) recordVisit(entry, 'removed');
}

export function listVisitHistory() {
  return db.all('visitHistory').sort((a, b) => b.date.localeCompare(a.date));
}
