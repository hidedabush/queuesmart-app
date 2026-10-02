import * as services from '../backend/servicesService';

/**
 * Services API. This and queue.js are the only files the front end imports
 * from outside src/frontend/.
 *
 * In A2 each function calls the backend module directly. In A3 the bodies
 * become network requests (the route each one maps to is noted beside it);
 * the names and return shapes stay the same, so the screens do not change.
 */

// GET /services
export function listServices() {
  return services.listServices();
}

// GET /services/:id
export function getService(id) {
  return services.getService(id);
}

// POST /services
export function createService(draft) {
  return services.createService(draft);
}

// PATCH /services/:id
export function updateService(id, draft) {
  return services.updateService(id, draft);
}

// DELETE /services/:id
export function deleteService(id) {
  return services.deleteService(id);
}

// PATCH /services/:id  { isOpen }
export function setQueueOpen(id, isOpen) {
  return services.setQueueOpen(id, isOpen);
}

// Computed by the server in A3 and returned with each service.
export { estimateWait, formatWait } from '../backend/waitEstimate';
