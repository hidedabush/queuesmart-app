import { nextId, query } from '../mysql.js';

// notifications: messages sent to one patient, 'sent' until they view them.

const RECENT = 20;

export async function insert({ userId, title, message }) {
  const row = { id: nextId('n'), userId, title, message, createdAt: Date.now(), status: 'sent' };
  await query('INSERT INTO notifications SET ?', [row]);
  return row;
}

// The newest ones, newest first.
export function listByUser(userId) {
  return query('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC, id DESC LIMIT ?', [
    userId,
    RECENT,
  ]);
}

// Returns false if the patient has no notification with this id.
export async function markViewed(userId, id) {
  const result = await query("UPDATE notifications SET status = 'viewed' WHERE id = ? AND userId = ?", [
    id,
    userId,
  ]);
  return result.affectedRows > 0;
}

export async function markAllViewed(userId) {
  await query("UPDATE notifications SET status = 'viewed' WHERE userId = ? AND status = 'sent'", [userId]);
}
