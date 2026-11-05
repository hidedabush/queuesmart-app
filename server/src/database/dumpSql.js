import { Buffer } from 'node:buffer';
import mysql from 'mysql2';
import { query } from './mysql.js';
import { schemaStatements, TABLES, triggerStatements } from './setup.js';

/**
 * A dump is one .sql file that rebuilds the database exactly as it was:
 *   1. DROP TABLE for each table (children first)
 *   2. CREATE TABLE (schema.sql)
 *   3. INSERT the rows (parents first)
 *   4. CREATE TRIGGER (triggers.sql), last, as mysqldump does, so loading
 *      the rows does not run the triggers on them (T1 would make a second
 *      queue per service, T5 would refuse lines that are full or closed)
 * It loads with `npm run db:load` or `mysql ... < dump.sql`.
 */

const ROWS_PER_INSERT = 200;

const parentsFirst = () => [...TABLES].reverse();

// mysql2 reads JSON columns (notifications.channels, user_profiles.
// preferences) back as objects; they go back in as JSON text.
export function sqlValue(value) {
  const isJson = value !== null && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value);
  return mysql.escape(isJson ? JSON.stringify(value) : value);
}

export function insertStatements(table, rows) {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  const head = `INSERT INTO ${mysql.escapeId(table)} (${columns.map((c) => mysql.escapeId(c)).join(', ')}) VALUES`;

  const statements = [];
  for (let start = 0; start < rows.length; start += ROWS_PER_INSERT) {
    const values = rows
      .slice(start, start + ROWS_PER_INSERT)
      .map((row) => `  (${columns.map((column) => sqlValue(row[column])).join(', ')})`);
    statements.push(`${head}\n${values.join(',\n')}`);
  }
  return statements;
}

// tables: { tableName: rows[] }. Returns the whole file as text.
export function buildDump(tables, { createdAt = new Date(), schema = schemaStatements(), triggers = triggerStatements() } = {}) {
  const counts = parentsFirst().map((table) => `--   ${table}: ${(tables[table] ?? []).length} rows`);
  const data = parentsFirst().flatMap((table) => insertStatements(table, tables[table] ?? []));

  return [
    '-- QueueSmart database dump',
    `-- Made by \`npm run db:dump\` at ${createdAt.toISOString()}.`,
    '-- Load it with `npm run db:load`, or `mysql -h HOST -P PORT -u USER -p DB < dump.sql`.',
    '-- Loading REPLACES these tables and everything in them:',
    ...counts,
    '',
    '-- 1. Start clean.',
    ...TABLES.map((table) => `DROP TABLE IF EXISTS ${mysql.escapeId(table)};`),
    '',
    '-- 2. Tables (src/database/schema.sql).',
    ...schema.map((statement) => `${statement};\n`),
    '-- 3. Rows. Loaded before the triggers exist, so they are not run again.',
    ...data.map((statement) => `${statement};\n`),
    '-- 4. Triggers (src/database/triggers.sql).',
    'DELIMITER $$',
    ...triggers.map((statement) => `${statement}$$\n`),
    'DELIMITER ;',
    '',
  ].join('\n');
}

// Every stored column (not the generated activeUserId and calledQueueId),
// in table order.
async function storedColumns(table) {
  const rows = await query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND EXTRA NOT LIKE '%GENERATED%'
     ORDER BY ORDINAL_POSITION`,
    [table]
  );
  return rows.map((row) => row.name);
}

// Reads every table, parents first, in a stable order.
export async function readTables() {
  const tables = {};
  for (const table of parentsFirst()) {
    const columns = await storedColumns(table);
    tables[table] = await query(`SELECT ?? FROM ?? ORDER BY 1`, [columns, table]);
  }
  return tables;
}
