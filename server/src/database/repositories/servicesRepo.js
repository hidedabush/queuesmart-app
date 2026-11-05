import { nextId, query, queryOne, transaction } from '../mysql.js';

// services + queues. Every service has exactly one queue, made by a trigger
// when the service is inserted (triggers.sql, T1), and the API's isOpen is
// that queue's status.

const SELECT_SERVICE = `
  SELECT s.*, q.status = 'open' AS isOpen
  FROM services s
  JOIN queues q ON q.serviceId = s.id`;

// MySQL returns the comparison as 0 or 1.
const toService = (row) => row && { ...row, isOpen: Boolean(row.isOpen) };

export async function list() {
  const rows = await query(`${SELECT_SERVICE} ORDER BY q.createdAt, s.id`);
  return rows.map(toService);
}

export async function findById(id) {
  return toService(await queryOne(`${SELECT_SERVICE} WHERE s.id = ?`, [id]));
}

// The column's collation ignores case. exceptId skips the row being edited.
export async function findByName(name, exceptId = null) {
  const row = await queryOne(`${SELECT_SERVICE} WHERE s.name = ? AND (? IS NULL OR s.id <> ?)`, [
    name.trim(),
    exceptId,
    exceptId,
  ]);
  return toService(row);
}

// The trigger opens the new queue; a service created closed is closed in the
// same transaction, so nobody can check in between the two.
export async function insert({ isOpen = true, ...fields }) {
  const service = { ...fields, id: nextId('s') };

  await transaction(async (run) => {
    await run('INSERT INTO services SET ?', [service]);
    if (!isOpen) {
      await run("UPDATE queues SET status = 'closed' WHERE serviceId = ?", [service.id]);
    }
  });

  return { ...service, isOpen };
}

// A capacity below the waiting count is refused by a trigger (T2).
export async function update(id, { isOpen, ...fields }) {
  if (Object.keys(fields).length > 0) {
    await query('UPDATE services SET ? WHERE id = ?', [fields, id]);
  }
  if (isOpen !== undefined) {
    await query('UPDATE queues SET status = ? WHERE serviceId = ?', [isOpen ? 'open' : 'closed', id]);
  }
  return findById(id);
}

// Refused by a trigger while anyone is in line (T3). Otherwise its queue and
// finished entries go too (ON DELETE CASCADE); visit history keeps its rows.
export async function remove(id) {
  await query('DELETE FROM services WHERE id = ?', [id]);
}
