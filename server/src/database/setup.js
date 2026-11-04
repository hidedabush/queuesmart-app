import { readFileSync } from 'node:fs';
import { query, queryOne, transaction } from './mysql.js';

// Creating the tables and loading the demo data. migrate.js runs these from
// the npm scripts; nothing in the API calls them.

// Children before parents, so dropping never breaks a foreign key.
export const TABLES = [
  'visit_history',
  'notifications',
  'queue_entries',
  'queues',
  'services',
  'user_profiles',
  'user_credentials',
];

export const queueIdFor = (serviceId) => `queue-${serviceId}`;

export function schemaStatements() {
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  return schema
    .split(/;\s*$/m)
    .map((statement) => statement.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
}

export async function createTables() {
  for (const statement of schemaStatements()) {
    await query(statement);
  }
}

export async function dropTables() {
  for (const table of TABLES) {
    await query(`DROP TABLE IF EXISTS ${table}`);
  }
}

export async function isEmpty() {
  const { count } = await queryOne('SELECT COUNT(*) AS count FROM user_credentials');
  return count === 0;
}

// The app's row shapes (as in seed.js and the API) split into table rows.
export function toTableRows({ users = [], services = [], queueEntries = [], history = [], notifications = [] }) {
  return {
    user_credentials: users.map(({ id, email, passwordHash, role }) => ({ id, email, passwordHash, role })),
    user_profiles: users.map(({ email, name, dob, phone, preferences }) => ({
      email,
      fullName: name,
      dob,
      phone,
      preferences: preferences ? JSON.stringify(preferences) : null,
    })),
    services: services.map(({ isOpen, ...service }) => service),
    queues: services.map((service) => ({
      id: queueIdFor(service.id),
      serviceId: service.id,
      status: service.isOpen ? 'open' : 'closed',
    })),
    queue_entries: queueEntries.map((entry) => ({
      id: entry.id,
      queueId: queueIdFor(entry.serviceId),
      userId: entry.userId,
      reason: entry.reason,
      position: entry.order,
      priority: entry.priority,
      status: entry.status,
      joinedAt: entry.arrivedAt,
      calledAt: entry.calledAt,
      leftAt: entry.leftAt ?? null,
    })),
    notifications,
    visit_history: history,
  };
}

// All or nothing: a failed row leaves the database as it was.
export function insertAll(data) {
  const tables = toTableRows(data);

  return transaction(async (run) => {
    for (const table of [...TABLES].reverse()) {
      const rows = tables[table];
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const values = rows.map((row) => columns.map((column) => row[column]));
      await run(`INSERT INTO ${table} (??) VALUES ?`, [columns, values]);
    }
    return Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length]));
  });
}
