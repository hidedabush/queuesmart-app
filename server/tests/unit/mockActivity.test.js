import { describe, expect, it } from 'vitest';
import { statsForDate, today } from '../../src/api/services/statsService.js';
import * as mock from '../../src/database/mock/activity.js';
import { AppError, conflict } from '../../src/api/errors.js';
import * as db from '../fakes/db.js';

// The mock-data engine on the in-memory tables, driving the app's own queue
// services (their history and notifications included). tests/mysql/ checks
// the triggers on a real database.

const services = () => db.all('services');
const finished = () => db.all('queueEntries').filter((e) => !['waiting', 'called'].includes(e.status));

describe('seeded random numbers', () => {
  it('repeat for the same seed and stay in range', () => {
    const [a, b] = [mock.makeRandom(42), mock.makeRandom(42)];
    const first = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);

    const random = mock.makeRandom(1);
    for (let i = 0; i < 50; i += 1) {
      const n = mock.between(random, 2, 4);
      expect(n >= 2 && n <= 4).toBe(true);
    }
  });

  it('picks every kind of outcome, mostly seen', () => {
    const random = mock.makeRandom(3);
    const picks = Array.from({ length: 400 }, () => mock.pickOutcome(random));
    expect(new Set(picks)).toEqual(new Set(['seen', 'no-show', 'cancelled', 'removed']));
    expect(picks.filter((p) => p === 'seen').length).toBeGreaterThan(200);
  });
});

describe('mock patients', () => {
  it('are fictional front-desk patients that pass the database rules', () => {
    const random = mock.makeRandom(4);
    for (let i = 0; i < 30; i += 1) {
      const patient = mock.mockPatient(random, `k${i}`);
      expect(patient).toMatchObject({ email: `mock-k${i}@queuesmart.test`, passwordHash: null, role: 'user' });
      expect(patient.name).toMatch(/^\S+ \S+$/);
      expect(patient.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(patient.phone === null || /^\d{10}$/.test(patient.phone)).toBe(true);
    }
  });

  it('give a reason that fits the visit type', () => {
    const random = mock.makeRandom(5);
    expect(['Flu shot', 'Tetanus booster', 'COVID booster']).toContain(mock.reasonFor(random, 'Vaccinations'));
    expect(mock.reasonFor(random, 'Something New')).toBe('Walk-in visit');
  });
});

describe('visit times', () => {
  const now = Date.parse('2026-11-04T18:00:00Z');
  const joinedAt = now - 60 * 60_000;

  it('a seen visit is called, then leaves after the visit length', () => {
    const times = mock.visitTimes('seen', joinedAt, now, mock.makeRandom(1), 15);
    expect(times.calledAt).toBeGreaterThan(joinedAt);
    expect(times.leftAt - times.calledAt).toBe(15 * 60_000);
  });

  it('a cancelled visit is never called', () => {
    expect(mock.visitTimes('cancelled', joinedAt, now, mock.makeRandom(1), 15).calledAt).toBeNull();
  });

  it('never ends after now', () => {
    const times = mock.visitTimes('seen', now - 2 * 60_000, now, mock.makeRandom(1), 60);
    expect(times.leftAt).toBeLessThan(now);
    expect(times.calledAt).toBeLessThanOrEqual(times.leftAt);
  });
});

describe('visits that already ended today', () => {
  const now = Date.parse('2026-11-04T18:00:00Z');

  it('come with their patient, history row and notices, on open lines only', () => {
    const rows = mock.pastVisits({ services: services(), now, random: mock.makeRandom(42), tag: 't1' });
    const closed = services().filter((s) => !s.isOpen).map((s) => s.id);

    expect(rows.history.length).toBeGreaterThanOrEqual(4 * 3);
    expect(rows.users).toHaveLength(rows.history.length);
    expect(rows.queueEntries).toHaveLength(rows.history.length);
    expect(rows.queueEntries.some((e) => closed.includes(e.serviceId))).toBe(false);
    expect(rows.history.every((h) => h.date === '2026-11-04' && h.leftAt < now)).toBe(true);

    rows.queueEntries.forEach((entry, i) => {
      const history = rows.history[i];
      expect(history).toMatchObject({ userId: entry.userId, joinedAt: entry.arrivedAt, leftAt: entry.leftAt });
      expect({ seen: 'served', 'no-show': 'no-show', cancelled: 'canceled', removed: 'removed' }[history.outcome]).toBe(
        entry.status
      );
      const sent = rows.notifications.filter((n) => n.entryId === entry.id).map((n) => n.type);
      expect(sent).toEqual(entry.calledAt ? ['joined', 'called'] : ['joined']);
    });
    expect(rows.notifications.every((n) => n.read && !n.message.includes(rows.queueEntries[0].reason))).toBe(true);
  });

  it('get new ids every run', () => {
    const first = mock.pastVisits({ services: services(), random: mock.makeRandom(1) });
    const second = mock.pastVisits({ services: services(), random: mock.makeRandom(1) });
    const ids = [...first.users, ...second.users].map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('start no earlier than UTC midnight, so they all count for today', () => {
    const justAfterMidnight = Date.parse('2026-11-04T00:30:00Z');
    const rows = mock.pastVisits({ services: services(), now: justAfterMidnight, random: mock.makeRandom(2) });
    expect(rows.history.every((h) => h.date === '2026-11-04' && h.joinedAt >= justAfterMidnight - 30 * 60_000)).toBe(
      true
    );
  });
});

describe('patients checking in now', () => {
  it('go through the real check-in, with a joined notice each', async () => {
    const before = db.all('queueEntries').length;

    const summary = await mock.addWaiting({ random: mock.makeRandom(6), perLine: [1, 1] });

    expect(summary.waiting).toBe(4);
    expect(db.all('queueEntries')).toHaveLength(before + 4);
    expect(db.all('notifications').filter((n) => n.type === 'joined')).toHaveLength(4);
  });

  it('are refused, not thrown, when a line is full', async () => {
    const injury = services().find((s) => s.id === 's2');
    db.update('services', injury.id, { capacity: 2 });

    const summary = await mock.addWaiting({ random: mock.makeRandom(7), perLine: [1, 1] });

    expect(summary.refused).toContainEqual(expect.objectContaining({ service: 'Minor Injury', code: 'full' }));
  });
});

describe('live events', () => {
  it('does nothing without visit types', async () => {
    for (const service of services()) db.remove('services', service.id);
    expect(await mock.tick({ random: mock.makeRandom(1) })).toEqual({ type: 'idle', service: null });
  });

  it('keeps the line moving through the app, with history for every visit that ends', async () => {
    const random = mock.makeRandom(7);
    const seen = new Set();
    const historyBefore = db.all('history').length;

    for (let i = 0; i < 300; i += 1) seen.add((await mock.tick({ random })).type);

    expect(seen).toEqual(new Set(['joined', 'called', 'seen', 'no-show', 'cancelled', 'refused']));
    expect(db.all('history').length - historyBefore).toBe(finished().length);
    expect(db.all('notifications').some((n) => n.type === 'called')).toBe(true);
    for (const service of services()) {
      const called = db.all('queueEntries').filter((e) => e.serviceId === service.id && e.status === 'called');
      expect(called.length).toBeLessThanOrEqual(1);
    }
  });

  it('shows up in today’s statistics', async () => {
    const random = mock.makeRandom(8);
    for (let i = 0; i < 200; i += 1) await mock.tick({ random });

    const stats = await statsForDate(today());
    const ended = stats.services.reduce((sum, s) => sum + s.served + s.noShows + s.cancelled + s.removed, 0);
    expect(ended).toBe(finished().length);
  });

  it('turns a walk-in away from a closed line without registering them', async () => {
    const usersBefore = db.all('users').length;
    for (const service of services()) db.update('services', service.id, { isOpen: false });
    // Nobody in line, so the only thing that can happen is a check-in.
    for (const entry of db.all('queueEntries')) db.remove('queueEntries', entry.id);

    const event = await mock.tick({ random: mock.makeRandom(9) });

    expect(event).toMatchObject({ type: 'refused', code: 'closed' });
    expect(db.all('users')).toHaveLength(usersBefore);
  });
});

describe('refusals', () => {
  it('are reported from the service layer, a trigger or a UNIQUE key; anything else is thrown', () => {
    expect(mock.refusal(conflict('full', 'Line full.'))).toEqual({ code: 'full', message: 'Line full.' });
    const signal = { code: 'ER_SIGNAL_EXCEPTION', sqlMessage: 'closed|This line is closed.' };
    expect(mock.refusal(signal)).toEqual({ code: 'closed', message: 'This line is closed.' });
    expect(mock.refusal({ code: 'ER_DUP_ENTRY' }).code).toBe('conflict');
    expect(() => mock.refusal(new AppError(404, 'not-found', 'Gone.'))).toThrow('Gone.');
    expect(() => mock.refusal(new Error('connection lost'))).toThrow('connection lost');
  });
});
