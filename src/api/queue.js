
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

