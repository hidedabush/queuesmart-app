import { validationError } from '../errors.js';
import { listForUser, today } from '../services/historyService.js';
import { statsForDate } from '../services/statsService.js';
import { isIsoDate } from '../validation/rules.js';

export function mine(req, res) {
  res.json({ history: listForUser(req.user.id) });
}

export function stats(req, res) {
  const date = req.query.date ?? today();
  if (typeof date !== 'string' || !isIsoDate(date)) {
    throw validationError({ date: 'Use a real date as YYYY-MM-DD.' });
  }
  res.json(statsForDate(date));
}
