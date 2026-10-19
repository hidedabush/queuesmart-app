import { validationError } from '../errors.js';
import { statsForDate, today } from '../services/statsService.js';
import { isIsoDate } from '../validation/rules.js';

// GET /stats?date=YYYY-MM-DD  (defaults to today)
export function stats(req, res) {
  const date = req.query.date ?? today();
  if (typeof date !== 'string' || !isIsoDate(date)) {
    throw validationError({ date: 'Use a real date as YYYY-MM-DD.' });
  }
  res.json(statsForDate(date));
}
