import { request } from './client';

// Notifications the server's Notification component sent this patient.
// See docs/A3-api-spec.txt section 6.

// GET /notifications/me  -> { notifications, unread }
export function listNotifications() {
  return request('GET', '/notifications/me');
}

// PATCH /notifications/:id/read
export function markRead(id) {
  return request('PATCH', `/notifications/${id}/read`);
}

// POST /notifications/me/read-all
export function markAllRead() {
  return request('POST', '/notifications/me/read-all');
}
