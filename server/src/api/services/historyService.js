import * as historyRepo from '../../database/repositories/historyRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';

/**
 * History module: one row each time a patient leaves a line, whatever the
 * reason. The visit type's name is copied in, so old visits still read
 * correctly after a visit type is renamed or deleted.
 */
export function today(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function record(entry, outcome, now = Date.now()) {
  const service = servicesRepo.findById(entry.serviceId);
  return historyRepo.insert({
    userId: entry.userId,
    serviceId: entry.serviceId,
    serviceName: service?.name ?? 'Visit',
    date: today(now),
    joinedAt: entry.arrivedAt,
    calledAt: entry.calledAt ?? null,
    leftAt: now,
    outcome,
  });
}

// A patient's own visits, newest first.
export function listForUser(userId) {
  return historyRepo
    .listByUser(userId)
    .sort((a, b) => b.leftAt - a.leftAt)
    .map(({ id, serviceId, serviceName, date, joinedAt, leftAt, outcome }) => ({
      id,
      serviceId,
      serviceName,
      date,
      joinedAt,
      leftAt,
      outcome,
    }));
}
