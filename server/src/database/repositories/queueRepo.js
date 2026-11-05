import { nextId, query, queryOne } from '../mysql.js';
import { queueIdFor } from '../setup.js';

// queue_entries, read with the service of their queue. The API calls the
// position column `order` and joinedAt `arrivedAt`, so they are renamed here.
// "In line" means waiting or called; other statuses are finished visits.
//
// Service management and the statistics only read the line. The writes
// (join, call, finish) are used by the mock-data scripts; the triggers decide
// whether each one is allowed and fill in the times (triggers.sql, T5-T7).

const SELECT_ENTRY = `
  SELECT e.id, q.serviceId, e.status, e.priority,
         e.position AS \`order\`, e.joinedAt AS arrivedAt, e.calledAt, e.leftAt
  FROM queue_entries e
  JOIN queues q ON q.id = e.queueId`;

const IN_LINE = "e.status IN ('waiting', 'called')";

// Everyone still in line for one service.
export function listByService(serviceId) {
  return query(`${SELECT_ENTRY} WHERE q.serviceId = ? AND ${IN_LINE} ORDER BY e.position`, [serviceId]);
}

// Urgent first, then arrival order: the order the front desk calls them in.
export function listWaiting(serviceId) {
  return query(
    `${SELECT_ENTRY} WHERE q.serviceId = ? AND e.status = 'waiting'
     ORDER BY e.priority = 'urgent' DESC, e.position`,
    [serviceId]
  );
}

export function findCalled(serviceId) {
  return queryOne(`${SELECT_ENTRY} WHERE q.serviceId = ? AND e.status = 'called'`, [serviceId]);
}

// Any entry, including finished ones.
export function findById(entryId) {
  return queryOne(`${SELECT_ENTRY} WHERE e.id = ?`, [entryId]);
}

// Joins the line of a service. A closed or full line is refused by a
// trigger; position and (when left out) the arrival time are filled in.
export async function join(serviceId, { priority = 'normal', arrivedAt = 0 } = {}) {
  const id = nextId('q');
  await query('INSERT INTO queue_entries SET ?', [
    { id, queueId: queueIdFor(serviceId), priority, joinedAt: arrivedAt },
  ]);
  return findById(id);
}

// The front desk calls this patient. One called patient per queue (UNIQUE).
export async function call(entryId, calledAt = null) {
  await query("UPDATE queue_entries SET status = 'called', calledAt = ? WHERE id = ?", [calledAt, entryId]);
  return findById(entryId);
}

// The patient left the line: keep the row with how the visit ended. A
// trigger writes the matching visit_history row.
export async function finish(entryId, status, leftAt = null) {
  await query('UPDATE queue_entries SET status = ?, leftAt = ? WHERE id = ?', [status, leftAt, entryId]);
  return findById(entryId);
}
