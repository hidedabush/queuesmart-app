import * as db from '../db.js';

// Test stand-in for src/database/repositories/notificationRepo.js.

// Newest first.
export async function listByUser(userId) {
  return db
    .all('notifications')
    .filter((row) => row.userId === userId)
    .reverse()
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function findById(id) {
  return db.find('notifications', id);
}

// Has this patient already been sent this kind of notice for this check-in?
export async function hasForEntry(userId, entryId, type) {
  return db
    .all('notifications')
    .some((row) => row.userId === userId && row.entryId === entryId && row.type === type);
}

export async function insert(row) {
  return db.insert('notifications', { ...row, id: db.nextId('n') });
}

export async function update(id, patch) {
  return db.update('notifications', id, patch);
}

export async function markAllRead(userId) {
  db.all('notifications')
    .filter((row) => row.userId === userId && !row.read)
    .forEach((row) => db.update('notifications', row.id, { read: true }));
}

// Everything sent for one check-in.
export async function markEntryRead(entryId) {
  db.all('notifications')
    .filter((row) => row.entryId === entryId && !row.read)
    .forEach((row) => db.update('notifications', row.id, { read: true }));
}
