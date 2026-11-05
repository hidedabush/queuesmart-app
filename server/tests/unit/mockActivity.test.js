import { describe, expect, it } from 'vitest';
import { statsForDate, today } from '../../src/api/services/statsService.js';
import * as mock from '../../src/database/mock/activity.js';
import * as db from '../fakes/db.js';

// The mock-data engine on the in-memory tables. Their line copies the
// triggers (tests/fakes/repositories/queueRepo.js); tests/mysql/ checks the
// real ones.

const empty = () => {
  for (const service of db.all('services')) db.remove('services', service.id);
  for (const entry of db.all('queueEntries')) db.remove('queueEntries', entry.id);
  for (const row of db.all('history')) db.remove('history', row.id);
};

describe('seeded random numbers', () => {
  it('repeat for the same seed and stay in range', () => {
    const [a, b] = [mock.makeRandom(42), mock.makeRandom(42)];
    const first = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 1)).toBe(true);

    const random = mock.makeRandom(1);
    for (let i = 0; i < 50; i += 1) {
      expect(mock.between(random, 2, 4)).toBeGreaterThanOrEqual(2);
      expect(mock.between(random, 2, 4)).toBeLessThanOrEqual(4);
    }
    expect(['a', 'b']).toContain(mock.pick(random, ['a', 'b']));
  });

  it('picks every kind of outcome, mostly seen', () => {
    const random = mock.makeRandom(3);
    const picks = Array.from({ length: 400 }, () => mock.pickOutcome(random));
    expect(new Set(picks)).toEqual(new Set(['served', 'no-show', 'canceled', 'removed']));
    expect(picks.filter((p) => p === 'served').length).toBeGreaterThan(200);
  });
});

describe('visit times', () => {
  const now = Date.parse('2026-11-04T18:00:00Z');
  const joinedAt = now - 60 * 60_000;

  it('a seen visit is called, then leaves after the visit length', () => {
    const times = mock.visitTimes('served', joinedAt, now, mock.makeRandom(1), 15);
    expect(times.calledAt).toBeGreaterThan(joinedAt);
    expect(times.leftAt - times.calledAt).toBe(15 * 60_000);
  });

  it('a cancelled visit is never called', () => {
    expect(mock.visitTimes('canceled', joinedAt, now, mock.makeRandom(1), 15).calledAt).toBeNull();
  });

  it('never ends after now', () => {
    const late = now - 2 * 60_000;
    const times = mock.visitTimes('served', late, now, mock.makeRandom(1), 60);
    expect(times.leftAt).toBeLessThan(now);
    expect(times.calledAt).toBeLessThanOrEqual(times.leftAt);
  });
});

describe('populating an empty database', () => {
  it('adds the five sample visit types once', async () => {
    empty();
    expect((await mock.ensureServices()).map((s) => s.name)).toEqual([
      'Sick Visit',
      'Minor Injury',
      'Lab Work',
      'Vaccinations',
      'Prescription Refill',
    ]);
    expect(await mock.ensureServices()).toEqual([]);
    expect(db.all('services').find((s) => s.name === 'Prescription Refill').isOpen).toBe(false);
  });

  it('plays a day of visits that end up in today’s statistics', async () => {
    empty();
    await mock.ensureServices();
    const now = Date.now();

    const summary = await mock.fillToday({ now, random: mock.makeRandom(42) });

    expect(summary.finished).toBeGreaterThanOrEqual(4 * 3);
    expect(summary.waiting).toBeGreaterThanOrEqual(4);
    // The closed line is refused, never filled.
    expect(summary.refused).toContainEqual(expect.objectContaining({ service: 'Prescription Refill', code: 'closed' }));

    expect(db.all('history')).toHaveLength(summary.finished);
    expect(db.all('history').every((row) => row.date === today(now) && row.leftAt < now)).toBe(true);

    const stats = await statsForDate(today(now));
    const total = stats.services.reduce((sum, s) => sum + s.served + s.noShows + s.cancelled + s.removed, 0);
    expect(total).toBe(summary.finished);
    expect(stats.services.reduce((sum, s) => sum + s.currentlyWaiting, 0)).toBe(summary.waiting);
  });

  it('adds more each time it runs', async () => {
    empty();
    await mock.ensureServices();
    const random = mock.makeRandom(5);
    const first = await mock.fillToday({ random });
    const second = await mock.fillToday({ random });
    expect(db.all('history')).toHaveLength(first.finished + second.finished);
  });

  it('reports a full line instead of failing', async () => {
    empty();
    await mock.ensureServices();
    const tiny = db.all('services').find((s) => s.name === 'Minor Injury');
    db.update('services', tiny.id, { capacity: 1 });

    const summary = await mock.fillToday({ random: mock.makeRandom(9), waiting: [3, 3] });

    expect(summary.refused).toContainEqual(expect.objectContaining({ service: 'Minor Injury', code: 'full' }));
  });

  it('does not call a second patient while live mode is calling one', async () => {
    empty();
    await mock.ensureServices();
    const sick = db.all('services').find((s) => s.name === 'Sick Visit');
    const { call, join } = await import('../fakes/repositories/queueRepo.js');
    await call((await join(sick.id)).id);

    await mock.fillToday({ random: mock.makeRandom(11), visits: [6, 6] });

    const sickHistory = db.all('history').filter((row) => row.serviceId === sick.id);
    expect(sickHistory.every((row) => ['cancelled', 'removed'].includes(row.outcome))).toBe(true);
  });
});

describe('live events', () => {
  it('does nothing without visit types', async () => {
    empty();
    expect(await mock.tick({ random: mock.makeRandom(1) })).toEqual({ type: 'idle', service: null });
  });

  it('keeps the line moving and every finished visit in history', async () => {
    empty();
    await mock.ensureServices();
    const random = mock.makeRandom(7);
    const seen = new Set();

    for (let i = 0; i < 300; i += 1) seen.add((await mock.tick({ random })).type);

    expect(seen).toEqual(new Set(['joined', 'called', 'served', 'no-show', 'canceled', 'refused']));
    const finished = db.all('queueEntries').filter((e) => !['waiting', 'called'].includes(e.status));
    expect(db.all('history')).toHaveLength(finished.length);
    // Never two called at once in one line.
    for (const service of db.all('services')) {
      const called = db.all('queueEntries').filter((e) => e.serviceId === service.id && e.status === 'called');
      expect(called.length).toBeLessThanOrEqual(1);
    }
  });

  it('reports refusals and rethrows anything else', () => {
    const signal = { code: 'ER_SIGNAL_EXCEPTION', sqlMessage: 'closed|This line is closed to new check-ins.' };
    expect(mock.refusal(signal)).toEqual({ code: 'closed', message: 'This line is closed to new check-ins.' });
    expect(mock.refusal({ code: 'ER_DUP_ENTRY' }).code).toBe('already-calling');
    expect(() => mock.refusal(new Error('connection lost'))).toThrow('connection lost');
  });
});
