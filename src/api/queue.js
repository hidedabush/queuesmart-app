
import { request } from './client';

// Create a check-in for the selected visit type.
export async function checkIn(serviceId, reason) {
  const data = await request(
    'POST',
    `/services/${encodeURIComponent(serviceId)}/queue`,
    { reason }
  );

  return data.entry;
}

// Retrieve the signed-in patient's active check-in.
// The server returns null when the patient is not in a queue.
export async function getMyQueue() {
  const data = await request('GET', '/queue/me');

  return data.entry;
}

// Cancel the signed-in patient's active check-in.
// The server responds with HTTP 204 and no response body.
export async function cancelCheckIn() {
  await request('DELETE', '/queue/me');
}


// --- Front desk (staff only) ---

// GET /services/:id/queue -> { called, waiting }
export function getLine(serviceId) {
  return request('GET', `/services/${encodeURIComponent(serviceId)}/queue`);
}

// POST /services/:id/queue/call
export async function callNext(serviceId) {
  const data = await request('POST', `/services/${encodeURIComponent(serviceId)}/queue/call`);

  return data.called;
}

// POST /services/:id/queue/called  { outcome: 'seen' | 'no-show' }
export async function resolveCalled(serviceId, outcome) {
  const data = await request(
    'POST',
    `/services/${encodeURIComponent(serviceId)}/queue/called`,
    { outcome }
  );

  return data.resolved;
}

// PATCH /queue/:entryId  { direction: -1 | 1 }
export async function moveEntry(entryId, direction) {
  const data = await request('PATCH', `/queue/${encodeURIComponent(entryId)}`, { direction });

  return data.waiting;
}

// DELETE /queue/:entryId
export async function removeEntry(entryId) {
  await request('DELETE', `/queue/${encodeURIComponent(entryId)}`);
}
