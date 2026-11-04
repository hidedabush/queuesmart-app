import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

/**
 * The "Database [SQL]" box in the A1 container diagram: one connection pool
 * to the team's shared MySQL server. Only the repositories and migrate.js
 * call this file.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy server/.env.example to server/.env and paste in the connection string.'
  );
}

// Aiven only accepts encrypted connections signed by its own certificate.
const CA_FILE = new URL('../../aiven-ca.pem', import.meta.url);

const pool = mysql.createPool({
  // Aiven's URL ends in ?ssl-mode=REQUIRED, an option mysql2 does not know.
  uri: process.env.DATABASE_URL.split('?')[0],
  connectionLimit: 5,
  // DATE columns stay YYYY-MM-DD strings, as the API returns them.
  dateStrings: true,
  ssl: existsSync(CA_FILE) ? { ca: readFileSync(CA_FILE) } : undefined,
});

export async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// Runs work(run) on one connection: every run() is saved together, or, if
// anything throws, none of them are.
export async function transaction(work) {
  const connection = await pool.getConnection();
  const run = async (sql, params) => (await connection.query(sql, params))[0];

  try {
    await connection.beginTransaction();
    const result = await work(run);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Short, readable ids that stay unique across everyone sharing the database.
export function nextId(prefix) {
  return `${prefix}${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
}

export function close() {
  return pool.end();
}
