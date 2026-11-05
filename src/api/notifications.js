import { request } from './client';

/**
 * Notifications API (docs/A3-api-spec.txt section 6). The patient dashboard
 * reads the result through ServicesStore.
 */

// GET /notifications/me: newest first, each with `read`.
export async function listMine() {
  return (await request('GET', '/notifications/me')).notifications;
}

// PATCH /notifications/:id/read
export async function markRead(id) {
  await request('PATCH', `/notifications/${encodeURIComponent(id)}/read`);
}

// POST /notifications/me/read-all
export async function markAllRead() {
  await request('POST', '/notifications/me/read-all');
}
