import * as db from '../db.js';

// Test stand-in for src/database/repositories/notificationRepo.js.

export async function insert({ userId, title, message }) {
  return db.insert('notifications', {
    id: db.nextId('n'),
    userId,
    title,
    message,
    createdAt: Date.now(),
    status: 'sent',
  });
}

// Newest first. Rows made in the same millisecond keep their insert order.
export async function listByUser(userId) {
  return db
    .all('notifications')
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.userId === userId)
    .sort((a, b) => b.row.createdAt - a.row.createdAt || b.index - a.index)
    .slice(0, 20)
    .map(({ row }) => row);
}

export async function markViewed(userId, id) {
  const row = db.find('notifications', id);
  if (!row || row.userId !== userId) return false;
  db.update('notifications', id, { status: 'viewed' });
  return true;
}

export async function markAllViewed(userId) {
  db.all('notifications')
    .filter((row) => row.userId === userId)
    .forEach((row) => db.update('notifications', row.id, { status: 'viewed' }));
}
