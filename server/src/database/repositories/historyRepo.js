import * as db from '../db.js';

// Visit history table: one row each time a patient leaves a line.

export function insert(row) {
  return db.insert('history', { ...row, id: db.nextId('h') });
}

export function listByUser(userId) {
  return db.all('history').filter((row) => row.userId === userId);
}

export function listByDate(date) {
  return db.all('history').filter((row) => row.date === date);
}
