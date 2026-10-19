import { request } from './client';

/**
 * Services API (visit types). This, queue.js, auth.js and notifications.js
 * are the only files the front end uses to reach the server; the screens use
 * them through src/frontend/state/ServicesStore.js.
 *
 * Each service comes back with `waiting`, `hasCalled` and `estimatedWait`
 * worked out by the server.
 */

// GET /services
export async function listServices() {
  return (await request('GET', '/services')).services;
}

// GET /services/:id
export async function getService(id) {
  return (await request('GET', `/services/${id}`)).service;
}

// POST /services  (staff only)
export async function createService(draft) {
  return (await request('POST', '/services', draft)).service;
}

// PATCH /services/:id  (staff only)
export async function updateService(id, draft) {
  return (await request('PATCH', `/services/${id}`, draft)).service;
}

// DELETE /services/:id  (staff only)
export async function deleteService(id) {
  await request('DELETE', `/services/${id}`);
  return {};
}

// PATCH /services/:id/open  { isOpen }  (staff only)
export async function setQueueOpen(id, isOpen) {
  return (await request('PATCH', `/services/${id}/open`, { isOpen })).service;
}

// GET /stats?date=YYYY-MM-DD  (staff only)
export function getStats(date) {
  return request('GET', date ? `/stats?date=${date}` : '/stats');
}
