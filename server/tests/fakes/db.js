import { seedTables } from '../../src/database/seed.js';

/**
 * In-memory copy of the MySQL tables, for tests only. `npm test` swaps the
 * real repositories for the ones in ./repositories (see vitest.config.js),
 * because every test resets its data and the real database is shared.
 *
 * Rows are copied on the way in and out so nothing outside this file can
 * change a table by mutating an object it was handed.
 */
let tables = seedTables();
let counters = {};

// Back to the seed rows. Tests call this before every test.
export function reset() {
  tables = seedTables();
  counters = {};
}

// Short, readable ids that never collide inside one process: u1, s7, q12...
export function nextId(prefix) {
  counters[prefix] = (counters[prefix] ?? 0) + 1;
  return `${prefix}${Date.now().toString(36)}${counters[prefix]}`;
}

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
