import * as historyRepo from '../../database/repositories/historyRepo.js';
import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';

/**
 * The admin's "view statistics" (A1 context diagram): per visit type, how
 * the day went, plus totals for the whole office. Everything is read from
 * history and the live line; nothing extra is stored.
 */
export function today(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

// Counts and average wait for a set of finished visits. The average wait is
// the mean of (called - joined) over "seen" visits, in whole minutes, or null
// when nobody was seen (no division by zero).
function summarize(rows) {
  const count = (outcome) => rows.filter((row) => row.outcome === outcome).length;
  const waits = rows
    .filter((row) => row.outcome === 'seen' && row.calledAt && row.joinedAt)
    .map((row) => (row.calledAt - row.joinedAt) / 60_000);

  return {
    served: count('seen'),
    noShows: count('no-show'),
    cancelled: count('cancelled'),
    removed: count('removed'),
    averageWaitMinutes: waits.length
      ? Math.round(waits.reduce((sum, minutes) => sum + minutes, 0) / waits.length)
      : null,
  };
}

export async function statsForDate(date) {
  const rows = await historyRepo.listByDate(date);
  const allServices = await servicesRepo.list();

  const services = await Promise.all(allServices.map(async (service) => ({
    serviceId: service.id,
    name: service.name,
    currentlyWaiting: (await queueRepo.listWaiting(service.id)).length,
    ...summarize(rows.filter((row) => row.serviceId === service.id)),
  })));

  // Totals cover every visit that day, including visit types deleted since,
  // and average the raw waits rather than the rounded per-type averages.
  const totals = {
    currentlyWaiting: services.reduce((sum, service) => sum + service.currentlyWaiting, 0),
    ...summarize(rows),
  };

  return { date, services, totals };
}
