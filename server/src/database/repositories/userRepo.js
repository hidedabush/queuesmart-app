import * as db from '../db.js';

// Users table (patients and admins). In A4: SELECT/INSERT/UPDATE on `users`.

export function findById(id) {
  return db.find('users', id);
}

// Case-insensitive email lookup.
export function findByEmail(email) {
  const wanted = email.trim().toLowerCase();
  return db.all('users').find((u) => u.email.toLowerCase() === wanted) || null;
}

export function insert(user) {
  return db.insert('users', { ...user, id: db.nextId('u') });
}

export function update(id, patch) {
  return db.update('users', id, patch);
}