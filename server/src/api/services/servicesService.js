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
async function withLine(service) {
  const waiting = (await queueRepo.listWaiting(service.id)).length;
  return {
    ...service,
    waiting,
    hasCalled: Boolean(await queueRepo.findCalled(service.id)),
    estimatedWait: estimateWait(service, waiting),
  };
}

async function findOrThrow(id) {
  const service = await servicesRepo.findById(id);
  if (!service) throw notFound('This visit type does not exist.');
  return service;
}

async function assertNameFree(name, exceptId) {
  if (await servicesRepo.findByName(name, exceptId)) {
    throw conflict('name-taken', 'A visit type with this name already exists.');
  }
}

export async function listServices() {
  const services = await servicesRepo.list();
  return Promise.all(services.map(withLine));
}

export async function getService(id) {
  return withLine(await findOrThrow(id));
}

export async function createService(draft) {
  await assertNameFree(draft.name);
  const service = await servicesRepo.insert({
    capacity: DEFAULT_CAPACITY,
    ...draft,
    isOpen: true,
  });
  return withLine(service);
}

export async function updateService(id, patch) {
  await findOrThrow(id);
  if (patch.name !== undefined) await assertNameFree(patch.name, id);
  if (patch.capacity !== undefined) {
    const waiting = (await queueRepo.listWaiting(id)).length;
    if (patch.capacity < waiting) {
      throw conflict(
        'capacity-below-waiting',
        `${waiting} patients are already in line. Capacity cannot be lower than that.`
      );
    }
  }
  return withLine(await servicesRepo.update(id, patch));
}

// Closing stops new check-ins only; patients already in line keep their place.
export async function setQueueOpen(id, isOpen) {
  await findOrThrow(id);
  return withLine(await servicesRepo.update(id, { isOpen }));
}

// Patients are never dropped silently: a visit type can only be deleted once
// its line is empty (nobody waiting or being called).
export async function deleteService(id) {
  await findOrThrow(id);
  if ((await queueRepo.listByService(id)).length > 0) {
    throw conflict('patients-in-line', 'Patients are still in this line. Close it and let it clear first.');
  }
  await servicesRepo.remove(id);
}
