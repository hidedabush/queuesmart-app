import * as db from '../db.js';

// Test stand-in for src/database/repositories/historyRepo.js.

export async function listByDate(date) {
  return db.all('history').filter((row) => row.date === date);
}

// Every row for one patient, newest first.
export async function listByUser(userId) {
  return db
    .all('history')
    .filter((row) => row.userId === userId)
    .sort((a, b) => b.leftAt - a.leftAt);
}

export async function insert(row) {
  return db.insert('history', { ...row, id: db.nextId('h') });
}
