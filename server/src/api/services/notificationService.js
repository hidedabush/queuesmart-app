import * as notificationRepo from '../../database/repositories/notificationRepo.js';
import { notFound } from '../errors.js';

// Messages to a patient about their check-in. They can appear on a lock
// screen, so they name the visit type but never the reason for the visit.

export function notify(userId, title, message) {
  return notificationRepo.insert({ userId, title, message });
}

function toNotification(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    createdAt: row.createdAt,
    status: row.status,
  };
}

// GET /notifications/me: the caller's recent notifications, newest first.
export async function listMine(userId) {
  const rows = await notificationRepo.listByUser(userId);
  return { notifications: rows.map(toNotification) };
}

// PATCH /notifications/:id/viewed. Someone else's id is a 404, not a 403,
// so ids can't be probed.
export async function markViewed(userId, id) {
  if (!(await notificationRepo.markViewed(userId, id))) {
    throw notFound('This notification does not exist.');
  }
}

// PATCH /notifications/me/viewed ("Clear all").
export function markAllViewed(userId) {
  return notificationRepo.markAllViewed(userId);
}
