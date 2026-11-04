import { nextId, query } from '../mysql.js';

// visit_history. The admin dashboard's daily statistics read it; the
// history module writes a row every time a patient leaves a line and reads a
// patient's own rows for GET /history/me.

export function listByDate(date) {
  return query('SELECT * FROM visit_history WHERE date = ?', [date]);
}

// Every row for one patient, newest first.
export function listByUser(userId) {
  return query('SELECT * FROM visit_history WHERE userId = ? ORDER BY leftAt DESC', [userId]);
}

export async function insert(row) {
  const history = { ...row, id: nextId('h') };
  await query('INSERT INTO visit_history SET ?', [history]);
  return history;
}
