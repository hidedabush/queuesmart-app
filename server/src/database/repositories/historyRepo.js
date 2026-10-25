import * as db from '../db.js';

// Visit history table. The admin dashboard's daily statistics read it; the
// queue module writes a row every time a patient leaves a line. Reading a
// patient's own history (GET /history/me) belongs to the history teammate.

export function listByDate(date) {
  return db.all('history').filter((row) => row.date === date);
}

export function insert(row) {
  return db.insert('history', { ...row, id: db.nextId('h') });
}
