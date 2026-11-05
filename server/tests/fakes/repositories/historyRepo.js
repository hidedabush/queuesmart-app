import * as db from '../db.js';

// Test stand-in for src/database/repositories/historyRepo.js.

export async function listByDate(date) {
  return db.all('history').filter((row) => row.date === date);
}
