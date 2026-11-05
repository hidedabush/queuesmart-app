import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import * as userRepo from '../../database/repositories/userRepo.js';
import { conflict, notFound } from '../errors.js';
import { notifyCalled } from '../notifications/notificationService.js';
import { announceLineChange, getOrderedPatientLine, leaveLine } from './queueService.js';

// Front desk (staff) side of the queue: docs/A3-api-spec.txt section 5.

async function getServiceOrThrow(serviceId) {
  const service = await servicesRepo.findById(serviceId);
  if (!service) throw notFound('This visit type does not exist.');
  return service;
}

// Finished entries stay in the database but are no longer in line.
async function getEntryOrThrow(entryId) {
  const entry = await queueRepo.findById(entryId);
  if (!entry || !['waiting', 'called'].includes(entry.status)) {
    throw notFound('This patient is no longer in line.');
  }
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
async function toLineEntry(entry, position) {
  const user = await userRepo.findById(entry.userId);

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

async function waitingLine(serviceId) {
  const line = await getOrderedPatientLine(serviceId);
  return Promise.all(line.map((entry, index) => toLineEntry(entry, index + 1)));
}

// GET /services/:id/queue  ->  { called, waiting }
export async function getLine(serviceId) {
  await getServiceOrThrow(serviceId);
  const called = await queueRepo.findCalled(serviceId);

  return {
    called: called ? await toLineEntry(called, 0) : null,
    waiting: await waitingLine(serviceId),
  };
}

// POST /services/:id/queue/call  ->  { called }
// 409 already-calling | empty. Only one patient per line is called at a time.
// History is NOT written here: the patient has not left the line yet.
export async function callNext(serviceId) {
  const service = await getServiceOrThrow(serviceId);

  if (await queueRepo.findCalled(serviceId)) {
    throw conflict('already-calling', 'A patient is already being called for this line.');
  }

  const [next] = await getOrderedPatientLine(serviceId);
  if (!next) throw conflict('empty', 'Nobody is waiting in this line.');

  const called = await queueRepo.update(next.id, { status: 'called', calledAt: Date.now() });
  await notifyCalled(called, service);
  await announceLineChange(serviceId);

  return { called: await toLineEntry(called, 0) };
}

// POST /services/:id/queue/called  { outcome: 'seen' | 'no-show' }  ->  { resolved }
// 409 nothing-called
export async function resolveCalled(serviceId, outcome) {
  await getServiceOrThrow(serviceId);

  const called = await queueRepo.findCalled(serviceId);
  if (!called) throw conflict('nothing-called', 'Nobody is being called for this line.');

  // HISTORY: leaveLine writes the history row. Patient cancellations go
  // through queueService.cancelQueue, so never record the same entry twice.
  await leaveLine(called, outcome);

  return { resolved: await toLineEntry(called, 0) };
}

// A move only swaps with the neighbour at the same priority, so it can never
// jump an urgent patient. At the edge of a level nothing changes.
async function moveWithinLevel(entry, direction) {
  const line = await getOrderedPatientLine(entry.serviceId);
  const index = line.findIndex((item) => item.id === entry.id);
  const neighbour = index === -1 ? null : line[index + direction];

  if (!neighbour || neighbour.priority !== entry.priority) return;

  await queueRepo.update(entry.id, { order: neighbour.order });
  await queueRepo.update(neighbour.id, { order: entry.order });
}

// PATCH /queue/:entryId  { direction: -1 | 1 } or { priority: 'normal' | 'urgent' }
// ->  { waiting }. The entryUpdate schema guarantees exactly one of the two.
export async function moveEntry(entryId, { direction, priority }) {
  const entry = await getEntryOrThrow(entryId);

  if (direction !== undefined) {
    await moveWithinLevel(entry, direction);
  } else {
    await queueRepo.update(entry.id, { priority });
  }
  await announceLineChange(entry.serviceId);

  return { waiting: await waitingLine(entry.serviceId) };
}

// DELETE /queue/:entryId  (204)
export async function removeEntry(entryId) {
  const entry = await getEntryOrThrow(entryId);

  // HISTORY: same rule as in resolveCalled. Staff removals are 'removed'.
  await leaveLine(entry, 'removed');
  await announceLineChange(entry.serviceId);
}
