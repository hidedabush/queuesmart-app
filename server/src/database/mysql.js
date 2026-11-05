import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';

/**
 * The "Database [SQL]" box in the A1 container diagram: one connection pool
 * to the MySQL server on your own machine (Docker or a local install). Only
 * the repositories and the database scripts call this file.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Run npm run db:start in server/, or copy server/.env.example to server/.env.'
  );
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 5,
  // DATE columns stay YYYY-MM-DD strings, as the API returns them.
  dateStrings: true,
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

let counter = 0;

// Short, readable ids that stay unique across everyone sharing the database.
// Ids made by one server sort in the order they were made (the time, then a
// counter), so `ORDER BY createdAt, id` keeps same-millisecond rows in order.
export function nextId(prefix) {
  counter = (counter + 1) % 36 ** 3;
  const time = Date.now().toString(36).padStart(9, '0');
  return `${prefix}${time}${counter.toString(36).padStart(3, '0')}${randomBytes(2).toString('hex')}`;
}

export function close() {
  return pool.end();
}
