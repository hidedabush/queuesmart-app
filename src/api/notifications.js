import { request } from './client';

/**
 * Notifications API (docs/A4-database-design.txt section 5). The patient
 * dashboard reads the result through ServicesStore.
 */

// GET /notifications/me: newest first, each 'sent' or 'viewed'.
export async function listMine() {
  return (await request('GET', '/notifications/me')).notifications;
}

// PATCH /notifications/:id/viewed
export async function markViewed(id) {
  await request('PATCH', `/notifications/${encodeURIComponent(id)}/viewed`);
}

// PATCH /notifications/me/viewed
export async function markAllViewed() {
  await request('PATCH', '/notifications/me/viewed');
}
