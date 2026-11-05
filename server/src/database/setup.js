import { query, queryOne, transaction } from './mysql.js';
import { sampleTables, seedTables } from './seed.js';
import { readSqlFile } from './sqlFile.js';

// Creating the tables and triggers and loading the demo data. migrate.js,
// populate.js and dump.js run these from the npm scripts; nothing in the API
// calls them.

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

// triggers.sql, in file order.
export const TRIGGERS = [
  'trg_services_after_insert',
  'trg_services_before_update',
  'trg_services_before_delete',
  'trg_queues_before_update',
  'trg_entries_before_insert',
  'trg_entries_before_update',
  'trg_history_before_update',
];

// The queue each service gets (made by trigger T1).
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
  const { count } = await queryOne('SELECT COUNT(*) AS count FROM user_credentials');
  return count === 0;
}

// Row counts per table, parents first, for the scripts' summaries.
export async function counts() {
  const result = {};
  for (const table of [...TABLES].reverse()) {
    result[table] = (await queryOne(`SELECT COUNT(*) AS count FROM ${table}`)).count;
  }
  return result;
}

// The demo data npm run db:seed adds: the starting rows (accounts, visit
// types, people waiting) and a morning of visits that already ended today.
export function demoData(now = Date.now()) {
  const base = seedTables();
  const sample = sampleTables(now);
  return {
    ...base,
    users: [...base.users, ...sample.users],
    queueEntries: [...base.queueEntries, ...sample.queueEntries],
    history: [...base.history, ...sample.history],
    notifications: [...base.notifications, ...sample.notifications],
  };
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
    notifications: notifications.map(({ read, channels, ...notification }) => ({
      ...notification,
      channels: JSON.stringify(channels),
      status: read ? 'viewed' : 'sent',
    })),
    visit_history: history,
  };
}

// All or nothing: a failed row leaves the database as it was. Trigger T1
// has already made each new service's queue, so the queue rows only set
// its status (open or closed).
export function insertAll(data) {
  const tables = toTableRows(data);

  return transaction(async (run) => {
    for (const table of [...TABLES].reverse()) {
      const rows = tables[table];
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const values = rows.map((row) => columns.map((column) => row[column]));
      const upsert = table === 'queues' ? ' ON DUPLICATE KEY UPDATE status = VALUES(status)' : '';
      await run(`INSERT INTO ${table} (??) VALUES ?${upsert}`, [columns, values]);
    }
    return Object.fromEntries(Object.entries(tables).map(([table, rows]) => [table, rows.length]));
  });
}
