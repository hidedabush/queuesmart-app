import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import { SEED_SERVICES } from '../seed.js';
import { signalOf } from '../signals.js';

/**
 * Mock office activity for an empty database that fills up as you go.
 *
 *   ensureServices()  adds the five sample visit types that are missing
 *   fillToday()       plays a morning of visits that already ended today,
 *                     plus a few patients still waiting (npm run db:populate)
 *   tick()            one live event: a check-in, a call, a visit ending or
 *                     a cancellation, stamped with the current time
 *                     (npm run db:live)
 *
 * Every visit goes through the real line (join -> call -> finish), so the
 * triggers check each step and write the visit_history row the statistics
 * read. Nothing is inserted behind their back. A step a trigger refuses
 * (closed line, full line, someone already being called) is reported, not
 * thrown, because refusing it is the point.
 */

const MINUTE = 60_000;

// Small seeded random numbers (mulberry32), so `--seed 42` repeats a run.
export function makeRandom(seed = Date.now()) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const between = (random, low, high) => low + Math.floor(random() * (high - low + 1));
export const pick = (random, items) => items[Math.floor(random() * items.length)];

// How a finished visit ended: mostly seen.
export function pickOutcome(random) {
  const roll = random();
  if (roll < 0.7) return 'served';
  if (roll < 0.8) return 'no-show';
  if (roll < 0.92) return 'canceled';
  return 'removed';
}

// A refusal from a trigger or a UNIQUE key, as { code, message }; anything
// else is a real error and is thrown again.
export function refusal(error) {
  const signal = signalOf(error);
  if (signal) return signal;
  if (error?.code === 'ER_DUP_ENTRY') {
    return { code: 'already-calling', message: 'Someone in this line is already being called.' };
  }
  throw error;
}

export async function ensureServices() {
  const added = [];
  for (const { id, ...service } of SEED_SERVICES) {
    if (!(await servicesRepo.findByName(service.name))) {
      added.push(await servicesRepo.insert(service));
    }
  }
  return added;
}

// The times of one visit that ended before `now`, starting at joinedAt.
export function visitTimes(outcome, joinedAt, now, random, minutesEach) {
  const latest = now - 1000;
  const clamp = (time) => Math.min(time, latest);

  if (outcome === 'canceled' || outcome === 'removed') {
    return { joinedAt, calledAt: null, leftAt: clamp(joinedAt + between(random, 3, 25) * MINUTE) };
  }
  const calledAt = clamp(joinedAt + between(random, 4, 35) * MINUTE);
  const stay = outcome === 'served' ? minutesEach : 3;
  return { joinedAt, calledAt, leftAt: clamp(calledAt + stay * MINUTE) };
}

// One visit that already ended, played through the line.
async function pastVisit(service, outcome, times) {
  const entry = await queueRepo.join(service.id, { arrivedAt: times.joinedAt });
  if (times.calledAt !== null) await queueRepo.call(entry.id, times.calledAt);
  return queueRepo.finish(entry.id, outcome, times.leftAt);
}

// Today's activity so far, from up to three hours ago (never before UTC
// midnight, so it all counts as today) up to now.
export async function fillToday({ now = Date.now(), random = makeRandom(), visits = [3, 6], waiting = [1, 4] } = {}) {
  const midnight = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  const start = Math.max(now - 3 * 60 * MINUTE, midnight);
  const summary = { finished: 0, waiting: 0, refused: [] };

  for (const service of await servicesRepo.list()) {
    if (!service.isOpen) {
      summary.refused.push({ service: service.name, code: 'closed', message: 'This line is closed to new check-ins.' });
      continue;
    }

    const count = between(random, ...visits);
    for (let i = 0; i < count; i += 1) {
      // Spread arrivals over the first two thirds of the window.
      const joinedAt = Math.round(start + ((i + random()) / count) * (now - start) * 0.66);
      let outcome = pickOutcome(random);
      // Only one patient per line can be called; if live mode is calling
      // someone right now, this past visit was a cancellation instead.
      if (['served', 'no-show'].includes(outcome) && (await queueRepo.findCalled(service.id))) {
        outcome = 'canceled';
      }
      try {
        await pastVisit(service, outcome, visitTimes(outcome, joinedAt, now, random, service.expectedDuration));
        summary.finished += 1;
      } catch (error) {
        summary.refused.push({ service: service.name, ...refusal(error) });
      }
    }

    // Arrived a few minutes apart, in line order, the last one just now.
    const stillWaiting = between(random, ...waiting);
    const gap = between(random, 2, 6) * MINUTE;
    for (let i = 0; i < stillWaiting; i += 1) {
      try {
        const arrivedAt = now - (stillWaiting - 1 - i) * gap - 1000;
        await queueRepo.join(service.id, { priority: random() < 0.1 ? 'urgent' : 'normal', arrivedAt });
        summary.waiting += 1;
      } catch (error) {
        summary.refused.push({ service: service.name, ...refusal(error) });
      }
    }
  }

  return summary;
}

/**
 * One thing happening at the office right now, for a random visit type:
 *   - the called patient's visit ends (seen most of the time, else no-show)
 *   - nobody is called: the front desk calls the next patient
 *   - a waiting patient cancels
 *   - a new patient checks in (urgent now and then)
 * Returns { type, service, entryId?, code?, message? }.
 */
export async function tick({ random = makeRandom() } = {}) {
  const services = await servicesRepo.list();
  if (services.length === 0) return { type: 'idle', service: null };

  // Mostly open lines; now and then a closed one, which the database refuses.
  const open = services.filter((s) => s.isOpen);
  const service = open.length > 0 && random() < 0.9 ? pick(random, open) : pick(random, services);
  const called = await queueRepo.findCalled(service.id);
  const waiting = await queueRepo.listWaiting(service.id);
  const roll = random();
  const event = (type, entry) => ({ type, service: service.name, entryId: entry.id });

  try {
    if (called && roll < 0.5) {
      const outcome = random() < 0.85 ? 'served' : 'no-show';
      return event(outcome, await queueRepo.finish(called.id, outcome));
    }
    if (!called && waiting.length > 0 && roll < 0.5) {
      return event('called', await queueRepo.call(waiting[0].id));
    }
    if (waiting.length > 0 && roll < 0.58) {
      return event('canceled', await queueRepo.finish(pick(random, waiting).id, 'canceled'));
    }
    const priority = random() < 0.1 ? 'urgent' : 'normal';
    return event('joined', await queueRepo.join(service.id, { priority }));
  } catch (error) {
    return { type: 'refused', service: service.name, ...refusal(error) };
  }
}
