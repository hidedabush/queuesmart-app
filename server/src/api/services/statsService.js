import * as historyRepo from '../../database/repositories/historyRepo.js';
import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';

/**
 * The admin's "view statistics" (A1 context diagram): per visit type, how
 * the day went. Everything is read from history and the live line; nothing
 * extra is stored.
 */
export function today(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function statsForDate(date) {
  const rows = historyRepo.listByDate(date);

  const services = servicesRepo.list().map((service) => {
    const mine = rows.filter((row) => row.serviceId === service.id);
    const count = (outcome) => mine.filter((row) => row.outcome === outcome).length;
    const waits = mine
      .filter((row) => row.outcome === 'seen' && row.calledAt && row.joinedAt)
      .map((row) => (row.calledAt - row.joinedAt) / 60_000);

    return {
      serviceId: service.id,
      name: service.name,
      currentlyWaiting: queueRepo.listWaiting(service.id).length,
      served: count('seen'),
      noShows: count('no-show'),
      cancelled: count('cancelled'),
      removed: count('removed'),
      averageWaitMinutes: waits.length
        ? Math.round(waits.reduce((sum, minutes) => sum + minutes, 0) / waits.length)
        : null,
    };
  });

  return { date, services };
}
