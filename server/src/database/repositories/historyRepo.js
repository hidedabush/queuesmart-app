import * as db from '../db.js';

// Visit history table. The admin dashboard's daily statistics read it; the
// history module writes a row every time a patient leaves a line and reads a
// patient's own rows for GET /history/me.

export function listByDate(date) {
  return db.all('history').filter((row) => row.date === date);
}

// Every row for one patient, newest first.
export function listByUser(userId) {
  return db
    .all('history')
    .filter((row) => row.userId === userId)
    .sort((a, b) => b.leftAt - a.leftAt);
}

export function insert(row) {
  return db.insert('history', { ...row, id: db.nextId('h') });
}
