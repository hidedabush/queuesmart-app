import * as db from '../db.js';

// Test stand-in for src/database/repositories/queueRepo.js. The writes copy
// what the triggers do in MySQL (src/database/triggers.sql, T5-T7), and
// refuse with the same error shape, so code that drives the line behaves
// the same on both. tests/mysql/ checks the real triggers.

const IN_LINE = ['waiting', 'called'];
const inLine = (entry) => IN_LINE.includes(entry.status);
const byOrder = (a, b) => a.order - b.order;
const OUTCOME = { served: 'seen', canceled: 'cancelled', 'no-show': 'no-show', removed: 'removed' };

// What mysql2 reports for SIGNAL SQLSTATE '45000'.
const refuse = (code, message) =>
  Object.assign(new Error(`${code}|${message}`), { code: 'ER_SIGNAL_EXCEPTION', sqlMessage: `${code}|${message}` });

export async function listByService(serviceId) {
  return db
    .all('queueEntries')
    .filter((entry) => entry.serviceId === serviceId && inLine(entry))
    .sort(byOrder);
}

export async function listWaiting(serviceId) {
  const urgentFirst = (a, b) => (b.priority === 'urgent') - (a.priority === 'urgent') || byOrder(a, b);
  return (await listByService(serviceId)).filter((entry) => entry.status === 'waiting').sort(urgentFirst);
}

export async function findCalled(serviceId) {
  return (await listByService(serviceId)).find((entry) => entry.status === 'called') || null;
}

export async function findById(entryId) {
  return db.find('queueEntries', entryId);
}

export async function join(serviceId, { priority = 'normal', arrivedAt = 0 } = {}) {
  const service = db.find('services', serviceId);
  if (!service) throw Object.assign(new Error('No such queue.'), { code: 'ER_NO_REFERENCED_ROW_2' });
  if (!service.isOpen) throw refuse('closed', 'This line is closed to new check-ins.');
  if ((await listWaiting(serviceId)).length >= service.capacity) throw refuse('full', 'This line is full for today.');

  const sameLine = db.all('queueEntries').filter((entry) => entry.serviceId === serviceId);
  return db.insert('queueEntries', {
    id: db.nextId('q'),
    serviceId,
    status: 'waiting',
    priority,
    order: Math.max(0, ...sameLine.map((entry) => entry.order)) + 1,
    arrivedAt: arrivedAt || Date.now(),
    calledAt: null,
    leftAt: null,
  });
}

function assertInLine(entry) {
  if (!inLine(entry)) throw refuse('visit-finished', 'This visit already ended and cannot change.');
}

// Like the real UPDATE, an unknown id changes nothing and reads back null.
export async function call(entryId, calledAt = null) {
  const entry = db.find('queueEntries', entryId);
  if (!entry) return null;
  assertInLine(entry);
  if (await findCalled(entry.serviceId)) {
    throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
  }
  return db.update('queueEntries', entryId, { status: 'called', calledAt: calledAt ?? Date.now() });
}

export async function finish(entryId, status, leftAt = null) {
  const entry = db.find('queueEntries', entryId);
  if (!entry) return null;
  assertInLine(entry);
  if (['served', 'no-show'].includes(status) && entry.status !== 'called') {
    throw refuse('not-called', 'Only the patient being called can be marked seen or no-show.');
  }
  const left = leftAt ?? Date.now();
  if (left < entry.arrivedAt) throw refuse('bad-time', 'A visit cannot end before the patient joined the line.');

  const finished = db.update('queueEntries', entryId, { status, leftAt: left });
  db.insert('history', {
    id: `h-${entryId}`,
    entryId,
    serviceId: entry.serviceId,
    serviceName: db.find('services', entry.serviceId).name,
    date: new Date(left).toISOString().slice(0, 10),
    joinedAt: entry.arrivedAt,
    calledAt: finished.calledAt,
    leftAt: left,
    outcome: OUTCOME[status],
  });
  return finished;
}
