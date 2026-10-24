import * as historyRepo from '../../database/repositories/historyRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';

// Visit history: one row each time a patient leaves a line.
// Never includes the reason for the visit.

export const OUTCOMES = ['seen', 'no-show', 'cancelled', 'removed'];

// Called by the queue code whenever an entry leaves a line, BEFORE the entry
// is removed:  seen | no-show (staff resolve)  cancelled (patient)  removed (staff).
export function recordOutcome(entry, outcome) {
  if (!OUTCOMES.includes(outcome)) throw new Error(`Unknown history outcome: ${outcome}`);

  const leftAt = Date.now();
  const service = servicesRepo.findById(entry.serviceId);

  return historyRepo.insert({
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service?.name ?? 'Visit',
    date: new Date(leftAt).toISOString().slice(0, 10), // YYYY-MM-DD (UTC, like the seed rows)
    joinedAt: entry.arrivedAt,
    calledAt: entry.calledAt ?? null,
    leftAt,
    outcome,
  });
}

function toHistoryEntry(row) {
  return {
    id: row.id,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    date: row.date,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    outcome: row.outcome,
  };
}

// Only the caller's own rows, newest first.
export function listMine(userId) {
  return { history: historyRepo.listByUser(userId).map(toHistoryEntry) };
}