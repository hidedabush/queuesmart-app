import * as db from '../db.js';

// Services (visit types) table. In A4: SELECT/INSERT/UPDATE/DELETE on `services`.

export function list() {
  return db.all('services');
}

export function findById(id) {
  return db.find('services', id);
}

// Case-insensitive name lookup, optionally ignoring one id (the row being edited).
export function findByName(name, exceptId = null) {
  const wanted = name.trim().toLowerCase();
  return (
    db.all('services').find((s) => s.id !== exceptId && s.name.toLowerCase() === wanted) || null
  );
}

export function insert(service) {
  return db.insert('services', { ...service, id: db.nextId('s') });
}

export function update(id, patch) {
  return db.update('services', id, patch);
}

export function remove(id) {
  db.remove('services', id);
}
