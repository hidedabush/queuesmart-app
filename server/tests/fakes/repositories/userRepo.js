import * as db from '../db.js';

// Test stand-in for src/database/repositories/userRepo.js.

export async function findById(id) {
  return db.find('users', id);
}

// Case-insensitive email lookup.
export async function findByEmail(email) {
  const wanted = email.trim().toLowerCase();
  return db.all('users').find((u) => u.email.toLowerCase() === wanted) || null;
}

export async function insert(user) {
  return db.insert('users', { phone: null, ...user, id: db.nextId('u') });
}

export async function setPasswordHash(id, passwordHash) {
  db.update('users', id, { passwordHash });
}
