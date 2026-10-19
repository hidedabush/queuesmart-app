import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import { conflict, notFound } from '../errors.js';
import { DEFAULT_CAPACITY } from './officeRules.js';
import { estimateWait } from './waitEstimate.js';

/**
 * Service management module (visit types). `waiting`, `hasCalled` and
 * `estimatedWait` are worked out from the line on every read rather than
 * stored, so they can never drift from the actual queue.
 */
function withLine(service) {
  const waiting = queueRepo.listWaiting(service.id).length;
  return {
    ...service,
    waiting,
    hasCalled: Boolean(queueRepo.findCalled(service.id)),
    estimatedWait: estimateWait(service, waiting),
  };
}

function findOrThrow(id) {
  const service = servicesRepo.findById(id);
  if (!service) throw notFound('This visit type does not exist.');
  return service;
}

function assertNameFree(name, exceptId) {
  if (servicesRepo.findByName(name, exceptId)) {
    throw conflict('name-taken', 'A visit type with this name already exists.');
  }
}

export function listServices() {
  return servicesRepo.list().map(withLine);
}

export function getService(id) {
  return withLine(findOrThrow(id));
}

export function createService(draft) {
  assertNameFree(draft.name);
  const service = servicesRepo.insert({
    capacity: DEFAULT_CAPACITY,
    ...draft,
    isOpen: true,
  });
  return withLine(service);
}

export function updateService(id, patch) {
  findOrThrow(id);
  if (patch.name !== undefined) assertNameFree(patch.name, id);
  if (patch.capacity !== undefined) {
    const waiting = queueRepo.listWaiting(id).length;
    if (patch.capacity < waiting) {
      throw conflict(
        'capacity-below-waiting',
        `${waiting} patients are already in line. Capacity cannot be lower than that.`
      );
    }
  }
  return withLine(servicesRepo.update(id, patch));
}

// Closing stops new check-ins only; patients already in line keep their place.
export function setQueueOpen(id, isOpen) {
  findOrThrow(id);
  return withLine(servicesRepo.update(id, { isOpen }));
}

// Patients are never dropped silently: a visit type can only be deleted once
// its line is empty (nobody waiting or being called).
export function deleteService(id) {
  findOrThrow(id);
  if (queueRepo.listByService(id).length > 0) {
    throw conflict('patients-in-line', 'Patients are still in this line. Close it and let it clear first.');
  }
  servicesRepo.remove(id);
}
