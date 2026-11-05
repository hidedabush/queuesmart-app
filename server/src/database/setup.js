import { query, queryOne } from './mysql.js';
import { readSqlFile } from './sqlFile.js';

// Creating, dropping and checking the tables. migrate.js, populate.js and
// dump.js run these from the npm scripts; nothing in the API calls them.

// Children before parents, so dropping never breaks a foreign key.
export const TABLES = ['visit_history', 'queue_entries', 'queues', 'services'];

export const TRIGGERS = [
  'trg_services_after_insert',
  'trg_services_before_update',
  'trg_services_before_delete',
  'trg_queues_before_update',
  'trg_entries_before_insert',
  'trg_entries_before_update',
  'trg_entries_after_update',
  'trg_history_before_update',
];

// The queue a trigger makes for each service (triggers.sql, T1).
export const queueIdFor = (serviceId) => `queue-${serviceId}`;

export const schemaStatements = () => readSqlFile('schema.sql');
export const triggerStatements = () => readSqlFile('triggers.sql');

export async function runAll(statements) {
  for (const statement of statements) {
    await query(statement);
  }
}

// Tables first, then the triggers that read them.
export async function createTables() {
  await runAll(schemaStatements());
  await runAll(triggerStatements());
}

// Dropping a table also drops its triggers.
export async function dropTables() {
  for (const table of TABLES) {
    await query(`DROP TABLE IF EXISTS ${table}`);
  }
}

export async function isEmpty() {
  const { count } = await queryOne('SELECT COUNT(*) AS count FROM services');
  return count === 0;
}

// Row counts per table, for the scripts' summaries.
export async function counts() {
  const result = {};
  for (const table of [...TABLES].reverse()) {
    result[table] = (await queryOne(`SELECT COUNT(*) AS count FROM ${table}`)).count;
  }
  return result;
}
