import { request } from './client';

// Queue API: the signed-in patient's check-in, and the front desk's view of
// each line. See docs/A3-api-spec.txt section 5.

// GET /queue/me  -> the patient's check-in with live position, or null
export async function getActiveQueue() {
  return (await request('GET', '/queue/me')).entry;
}

// POST /services/:id/queue  { reason }
export async function checkIn(serviceId, reason) {
  return { entry: (await request('POST', `/services/${serviceId}/queue`, { reason })).entry };
}

// DELETE /queue/me
export function cancelCheckIn() {
  return request('DELETE', '/queue/me');
}

// GET /history/me
export async function listVisitHistory() {
  return (await request('GET', '/history/me')).history;
}

// GET /services/:id/queue  -> { called, waiting }  (staff only)
export function getLine(serviceId) {
  return request('GET', `/services/${serviceId}/queue`);
}

// POST /services/:id/queue/call  (staff only)
export async function callNext(serviceId) {
  return { entry: (await request('POST', `/services/${serviceId}/queue/call`)).called };
}

// POST /services/:id/queue/called  { outcome: 'seen' | 'no-show' }  (staff only)
export async function resolveCalled(serviceId, outcome) {
  return (await request('POST', `/services/${serviceId}/queue/called`, { outcome })).resolved;
}

// PATCH /queue/:entryId  { direction }  (staff only)
export function moveEntry(serviceId, entryId, direction) {
  return request('PATCH', `/queue/${entryId}`, { direction });
}

// PATCH /queue/:entryId  { priority: 'normal' | 'urgent' }  (staff only)
export function setEntryPriority(entryId, priority) {
  return request('PATCH', `/queue/${entryId}`, { priority });
}

// DELETE /queue/:entryId  (staff only)
export function removeEntry(entryId) {
  return request('DELETE', `/queue/${entryId}`);
}
