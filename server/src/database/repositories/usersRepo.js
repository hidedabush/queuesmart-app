import * as db from '../db.js';

// Users table. In A4: SELECT/INSERT against `users`.

export function findById(id) {
  return db.find('users', id);
}

// Emails are stored lower-case, so this match ignores case.
export function findByEmail(email) {
  const wanted = email.trim().toLowerCase();
  return db.all('users').find((user) => user.email === wanted) || null;
}

export function insert(user) {
  return db.insert('users', { ...user, id: db.nextId('u') });
}

export function update(id, patch) {
  return db.update('users', id, patch);
}
