import * as db from '../db.js';

// Visit history table, read-only. The admin dashboard's daily statistics
// read it. Writing rows when a patient leaves a line belongs to the history
// module (history teammate), which adds the write functions here.

export function listByDate(date) {
  return db.all('history').filter((row) => row.date === date);
}
