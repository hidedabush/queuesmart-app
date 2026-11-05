import { nextId, query, queryOne } from '../mysql.js';

// queue_entries, read with the service of their queue. The API calls the
// position column `order` and joinedAt `arrivedAt`, so they are renamed here.
// "In line" means waiting or called; other statuses are finished visits.

const SELECT_ENTRY = `
  SELECT e.id, e.userId, q.serviceId, e.reason, e.status, e.priority,
         e.position AS \`order\`, e.joinedAt AS arrivedAt, e.calledAt, e.leftAt
  FROM queue_entries e
  JOIN queues q ON q.id = e.queueId`;

const IN_LINE = "e.status IN ('waiting', 'called')";

const COLUMNS = { order: 'position', arrivedAt: 'joinedAt' };

const toColumns = (patch) =>
  Object.fromEntries(Object.entries(patch).map(([field, value]) => [COLUMNS[field] ?? field, value]));

// Everyone still in line for one service.
export function listByService(serviceId) {
  return query(`${SELECT_ENTRY} WHERE q.serviceId = ? AND ${IN_LINE} ORDER BY e.position`, [serviceId]);
}

export function listWaiting(serviceId) {
  return query(`${SELECT_ENTRY} WHERE q.serviceId = ? AND e.status = 'waiting' ORDER BY e.position`, [
    serviceId,
  ]);
}

export function findCalled(serviceId) {
  return queryOne(`${SELECT_ENTRY} WHERE q.serviceId = ? AND e.status = 'called'`, [serviceId]);
}

export function findActiveByUser(userId) {
  return queryOne(`${SELECT_ENTRY} WHERE e.userId = ? AND ${IN_LINE}`, [userId]);
}

// Any entry, including finished ones.
export function findById(entryId) {
  return queryOne(`${SELECT_ENTRY} WHERE e.id = ?`, [entryId]);
}

// The entry goes into the queue of its service.
export async function insert(entry) {
  const id = nextId('q');
  const { serviceId, ...fields } = entry;
  const columns = toColumns({ id, ...fields });

  await query('INSERT INTO queue_entries (??, queueId) SELECT ?, id FROM queues WHERE serviceId = ?', [
    Object.keys(columns),
    Object.values(columns),
    serviceId,
  ]);
  return { ...entry, id, leftAt: null };
}

export async function update(entryId, patch) {
  await query('UPDATE queue_entries SET ? WHERE id = ?', [toColumns(patch), entryId]);
  return findById(entryId);
}

// The patient left the line: keep the row with how the visit ended.
export async function finish(entryId, status, leftAt = Date.now()) {
  await query('UPDATE queue_entries SET status = ?, leftAt = ? WHERE id = ?', [status, leftAt, entryId]);
}
