import * as db from '../db.js';

// Test stand-in for src/database/repositories/servicesRepo.js.

export async function list() {
  return db.all('services');
}

export async function findById(id) {
  return db.find('services', id);
}

// Case-insensitive name lookup, optionally ignoring one id (the row being edited).
export async function findByName(name, exceptId = null) {
  const wanted = name.trim().toLowerCase();
  return (
    db.all('services').find((s) => s.id !== exceptId && s.name.toLowerCase() === wanted) || null
  );
}

export async function insert(service) {
  return db.insert('services', { ...service, id: db.nextId('s') });
}

export async function update(id, patch) {
  return db.update('services', id, patch);
}

export async function remove(id) {
  db.remove('services', id);
}
