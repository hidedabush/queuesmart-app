import * as db from '../db.js';

// Notifications table. In A4: SELECT/INSERT/UPDATE on `notifications`.

// Newest first.
export function listByUser(userId) {
  return db
    .all('notifications')
    .filter((row) => row.userId === userId)
    .reverse()
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function findById(id) {
  return db.find('notifications', id);
}

// Has this patient already been sent this kind of notice for this check-in?
export function hasForEntry(userId, entryId, type) {
  return db
    .all('notifications')
    .some((row) => row.userId === userId && row.entryId === entryId && row.type === type);
}

export function insert(row) {
  return db.insert('notifications', { ...row, id: db.nextId('n') });
}

export function update(id, patch) {
  return db.update('notifications', id, patch);
}

export function markAllRead(userId) {
  db.all('notifications')
    .filter((row) => row.userId === userId && !row.read)
    .forEach((row) => db.update('notifications', row.id, { read: true }));
}

// Everything sent for one check-in.
export function markEntryRead(entryId) {
  db.all('notifications')
    .filter((row) => row.entryId === entryId && !row.read)
    .forEach((row) => db.update('notifications', row.id, { read: true }));
}