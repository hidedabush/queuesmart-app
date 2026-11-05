import { query } from '../mysql.js';

// visit_history. A trigger writes a row every time a visit leaves a line
// (triggers.sql, T7); the admin dashboard's daily statistics read it.

export function listByDate(date) {
  return query('SELECT * FROM visit_history WHERE date = ?', [date]);
}
