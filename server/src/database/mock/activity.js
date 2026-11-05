import * as queueRepo from '../../database/repositories/queueRepo.js';
import * as servicesRepo from '../../database/repositories/servicesRepo.js';
import * as userRepo from '../../database/repositories/userRepo.js';
import { AppError } from '../../api/errors.js';
import { calledMessage, joinedMessage } from '../../api/notifications/messages.js';
import { cancelQueue, joinQueue } from '../../api/services/queueService.js';
import { callNext, resolveCalled } from '../../api/services/staffQueueService.js';
import { signalOf } from '../signals.js';

/**
 * Mock office activity, so the database fills up as you go.
 *
 *   pastVisits()  a batch of visits that already ended earlier today, as
 *                 rows in the same shape as seed.js's sampleTables(), with
 *                 new ids every run (npm run db:populate inserts them)
 *   addWaiting()  new patients checking in right now (npm run db:populate)
 *   tick()        one live event (npm run db:live)
 *
 * Anything that happens "now" goes through the app's own services
 * (queueService, staffQueueService), so their rules, the history module and
 * the notification module run exactly as they do for a real patient, and the
 * database triggers check every write. A step that is refused (closed or
 * full line, someone already being called) is reported, not thrown, because
 * refusing it is the point.
 */

const MINUTE = 60_000;

const FIRST = ['Maria', 'James', 'Aisha', 'Wei', 'Carlos', 'Priya', 'Noah', 'Fatima', 'Liam', 'Grace', 'Omar', 'Sofia'];
const LAST = ['Garcia', 'Nguyen', 'Patel', 'Johnson', 'Kim', 'Okafor', 'Rossi', 'Haddad', 'Lopez', 'Chen', 'Brown', 'Silva'];

const REASONS = {
  'Sick Visit': ['Fever and chills', 'Sore throat for two days', 'Cough that will not go away', 'Ear pain'],
  'Minor Injury': ['Sprained wrist', 'Cut on hand from cooking', 'Rolled ankle on stairs'],
  'Lab Work': ['Fasting blood work', 'Cholesterol panel', 'A1C check'],
  Vaccinations: ['Flu shot', 'Tetanus booster', 'COVID booster'],
  'Prescription Refill': ['Blood pressure medication refill', 'Inhaler refill'],
};

// History outcome -> the status its queue entry ends with (as queueService).
const ENTRY_STATUS = { seen: 'served', 'no-show': 'no-show', cancelled: 'canceled', removed: 'removed' };

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
  if (roll < 0.7) return 'seen';
  if (roll < 0.8) return 'no-show';
  if (roll < 0.92) return 'cancelled';
  return 'removed';
}

export const reasonFor = (random, serviceName) => pick(random, REASONS[serviceName] ?? ['Walk-in visit']);

// A fictional patient registered at the front desk (no password, so they
// cannot sign in), with a unique email for `key`.
export function mockPatient(random, key) {
  const month = String(between(random, 1, 12)).padStart(2, '0');
  const day = String(between(random, 1, 28)).padStart(2, '0');
  return {
    name: `${pick(random, FIRST)} ${pick(random, LAST)}`,
    dob: `${between(random, 1950, 2010)}-${month}-${day}`,
    email: `mock-${key}@queuesmart.test`,
    phone: random() < 0.7 ? `713555${String(between(random, 0, 9999)).padStart(4, '0')}` : null,
    passwordHash: null,
    role: 'user',
  };
}

// A short id part that is new on every call: the time, a counter (for calls
// in the same millisecond) and a random part (for other processes).
let tags = 0;
export function batchTag(random) {
  tags = (tags + 1) % 1296;
  return `${Date.now().toString(36)}${tags.toString(36)}${between(random, 0, 1295).toString(36)}`;
}

// The times of one visit that ended before `now`, starting at joinedAt.
export function visitTimes(outcome, joinedAt, now, random, minutesEach) {
  const latest = now - 1000;
  const clamp = (time) => Math.min(time, latest);

  if (outcome === 'cancelled' || outcome === 'removed') {
    return { joinedAt, calledAt: null, leftAt: clamp(joinedAt + between(random, 3, 25) * MINUTE) };
  }
  const calledAt = clamp(joinedAt + between(random, 4, 35) * MINUTE);
  const stay = outcome === 'seen' ? minutesEach : 3;
  return { joinedAt, calledAt, leftAt: clamp(calledAt + stay * MINUTE) };
}

/**
 * Visits that already ended today on every open line: one new front-desk
 * patient each, their finished queue entry, their history row and the
 * notices they were sent (all read), dated from up to three hours ago (never
 * before UTC midnight) up to now. Returns rows for setup.insertAll().
 */
export function pastVisits({ services, now = Date.now(), random = makeRandom(), perLine = [3, 6], tag = batchTag(random) }) {
  const midnight = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  const start = Math.max(now - 3 * 60 * MINUTE, midnight);
  const rows = { users: [], queueEntries: [], history: [], notifications: [] };

  for (const service of services.filter((s) => s.isOpen)) {
    const count = between(random, ...perLine);

    for (let i = 0; i < count; i += 1) {
      const key = `${tag}-${rows.users.length + 1}`;
      const userId = `u-mock-${key}`;
      const entryId = `q-mock-${key}`;
      const outcome = pickOutcome(random);
      // Arrivals spread over the first two thirds of the window.
      const joinedAt = Math.round(start + ((i + random()) / count) * (now - start) * 0.66);
      const { calledAt, leftAt } = visitTimes(outcome, joinedAt, now, random, service.expectedDuration);

      rows.users.push({ id: userId, ...mockPatient(random, key) });
      rows.queueEntries.push({
        id: entryId,
        userId,
        serviceId: service.id,
        reason: reasonFor(random, service.name),
        status: ENTRY_STATUS[outcome],
        priority: random() < 0.1 ? 'urgent' : 'normal',
        order: 100 + i,
        arrivedAt: joinedAt,
        calledAt,
        leftAt,
      });
      rows.history.push({
        id: `h-mock-${key}`,
        userId,
        serviceId: service.id,
        serviceName: service.name,
        date: new Date(leftAt).toISOString().slice(0, 10),
        joinedAt,
        calledAt,
        leftAt,
        outcome,
      });

      const sent = [['joined', joinedAt, joinedMessage(service.name, i + 1, null)]];
      if (calledAt) sent.push(['called', calledAt, calledMessage(service.name)]);
      for (const [type, createdAt, text] of sent) {
        rows.notifications.push({
          id: `n-mock-${key}-${type}`,
          userId,
          type,
          ...text,
          serviceId: service.id,
          entryId,
          read: true,
          createdAt,
          channels: ['in-app'],
        });
      }
    }
  }

  return rows;
}

// A refusal from the service layer (409), a trigger or a UNIQUE key, as
// { code, message }; anything else is a real error and is thrown again.
export function refusal(error) {
  if (error instanceof AppError && error.status === 409) return { code: error.code, message: error.message };
  const signal = signalOf(error);
  if (signal) return signal;
  if (error?.code === 'ER_DUP_ENTRY') {
    return { code: 'conflict', message: 'That conflicts with something saved a moment ago.' };
  }
  throw error;
}

// A new patient checks in through queueService.joinQueue. Someone turned
// away from a closed line is never registered.
async function checkIn(service, random) {
  const userId = service.isOpen ? (await userRepo.insert(mockPatient(random, batchTag(random)))).id : 'u-mock-walk-in';
  return (await joinQueue(userId, service.id, reasonFor(random, service.name))).entry;
}

// New patients checking in now on every open line.
export async function addWaiting({ random = makeRandom(), perLine = [1, 3] } = {}) {
  const summary = { waiting: 0, refused: [] };

  for (const service of await servicesRepo.list()) {
    if (!service.isOpen) continue;
    for (let i = between(random, ...perLine); i > 0; i -= 1) {
      try {
        await checkIn(service, random);
        summary.waiting += 1;
      } catch (error) {
        summary.refused.push({ service: service.name, ...refusal(error) });
      }
    }
  }

  return summary;
}

/**
 * One thing happening at the office right now, for a random visit type
 * (mostly open ones):
 *   - the called patient's visit ends: seen, or now and then a no-show
 *   - nobody is called: the front desk calls the next patient
 *   - a waiting patient cancels
 *   - a new patient checks in
 * Returns { type, service, code?, message? }.
 */
export async function tick({ random = makeRandom() } = {}) {
  const services = await servicesRepo.list();
  if (services.length === 0) return { type: 'idle', service: null };

  const open = services.filter((s) => s.isOpen);
  const service = open.length > 0 && random() < 0.9 ? pick(random, open) : pick(random, services);
  const called = await queueRepo.findCalled(service.id);
  const waiting = await queueRepo.listWaiting(service.id);
  const roll = random();
  const event = (type) => ({ type, service: service.name });

  try {
    if (called && roll < 0.5) {
      const outcome = random() < 0.85 ? 'seen' : 'no-show';
      await resolveCalled(service.id, outcome);
      return event(outcome);
    }
    if (!called && waiting.length > 0 && roll < 0.5) {
      await callNext(service.id);
      return event('called');
    }
    if (waiting.length > 0 && roll < 0.58) {
      await cancelQueue(pick(random, waiting).userId);
      return event('cancelled');
    }
    await checkIn(service, random);
    return event('joined');
  } catch (error) {
    return { type: 'refused', service: service.name, ...refusal(error) };
  }
}
