import { SEED_QUEUE_ENTRIES, SEED_SERVICES } from './seed';

/**
 * In-memory database for Assignment 2.
 *
 * A2 requires no backend, so the "tables" are arrays that live for the app
 * session and reset on reload. Only src/backend/ talks to this file. In A3
 * these five functions are the ones to reimplement against a real database.
 *
 * Rows are copied on the way in and out so nothing outside this file can
 * change a table by mutating an object it was handed.
 */
const tables = {
  services: SEED_SERVICES.map((row) => ({ ...row })),
  queueEntries: SEED_QUEUE_ENTRIES.map((row) => ({ ...row })),
};

export function all(table) {
  return tables[table].map((row) => ({ ...row }));
}

export function find(table, id) {
  const row = tables[table].find((r) => r.id === id);
  return row ? { ...row } : null;
}

export function insert(table, row) {
  tables[table] = [...tables[table], { ...row }];
  return { ...row };
}

export function update(table, id, patch) {
  tables[table] = tables[table].map((r) => (r.id === id ? { ...r, ...patch } : r));
  return find(table, id);
}

export function remove(table, id) {
  tables[table] = tables[table].filter((r) => r.id !== id);
}
