import { describe, expect, it } from 'vitest';
import { statsForDate, today } from '../../src/api/services/statsService.js';
import * as db from '../fakes/db.js';
import { addToLine } from '../helpers.js';

// A finished visit, written straight to the history table. Recording visits
// belongs to the history module, which a teammate is building.
function visit(serviceId, outcome, { joined = '14:00', called = null } = {}) {
  const at = (time) => Date.parse(`2026-10-19T${time}:00Z`);
  db.insert('history', {
    id: db.nextId('h'),
    userId: 'u-test',
    serviceId,
    serviceName: 'Test',
    date: '2026-10-19',
    joinedAt: at(joined),
    calledAt: called ? at(called) : null,
    leftAt: at('15:00'),
    outcome,
  });
}

describe('statistics', () => {
  it("counts the day's outcomes per visit type and the average wait", async () => {
    visit('s2', 'seen', { joined: '14:00', called: '14:18' }); // 18 min
    visit('s2', 'seen', { joined: '14:00', called: '14:30' }); // 30 min
    visit('s2', 'no-show');
    visit('s2', 'cancelled');
    visit('s2', 'removed');

    const injury = (await statsForDate('2026-10-19')).services.find((s) => s.serviceId === 's2');
    expect(injury).toMatchObject({
      served: 2,
      noShows: 1,
      cancelled: 1,
      removed: 1,
      currentlyWaiting: 2,
      averageWaitMinutes: 24,
    });
  });

  it('includes everyone currently waiting', async () => {
    addToLine('s5');
    const refill = (await statsForDate('2026-10-19')).services.find((s) => s.serviceId === 's5');
    expect(refill.currentlyWaiting).toBe(1);
  });

  it('reports no average when nobody was seen that day', async () => {
    const { services: rows } = await statsForDate('2001-01-01');
    expect(rows.every((s) => s.served === 0 && s.averageWaitMinutes === null)).toBe(true);
  });

  it('totals add up every visit type and average the raw waits', async () => {
    visit('s1', 'seen', { joined: '14:00', called: '14:10' }); // 10 min
    visit('s1', 'seen', { joined: '14:00', called: '14:11' }); // 11 min
    visit('s2', 'seen', { joined: '14:00', called: '14:15' }); // 15 min
    visit('s2', 'seen', { joined: '14:00', called: '14:16' }); // 16 min
    visit('s1', 'no-show');
    visit('s3', 'cancelled');
    visit('s3', 'cancelled');
    visit('s4', 'removed');

    const { totals, services } = await statsForDate('2026-10-19');
    expect(totals).toMatchObject({ served: 4, noShows: 1, cancelled: 2, removed: 1 });
    // Raw: (10 + 11 + 15 + 16) / 4 = 13. Weighting the rounded per-type
    // averages (11 and 16, two visits each) would drift to 13.5 -> 14.
    expect(totals.averageWaitMinutes).toBe(13);
    expect(totals.currentlyWaiting).toBe(
      services.reduce((sum, service) => sum + service.currentlyWaiting, 0)
    );
  });

  it('totals still count visits of a visit type deleted since', async () => {
    visit('s-deleted', 'seen', { joined: '14:00', called: '14:20' });
    const { totals, services } = await statsForDate('2026-10-19');
    expect(services.some((s) => s.serviceId === 's-deleted')).toBe(false);
    expect(totals).toMatchObject({ served: 1, averageWaitMinutes: 20 });
  });

  it('totals on a day with no visits are zero with no average', async () => {
    const { totals } = await statsForDate('2001-01-01');
    expect(totals).toMatchObject({
      served: 0,
      noShows: 0,
      cancelled: 0,
      removed: 0,
      averageWaitMinutes: null,
    });
  });

  it("today is the UTC date as YYYY-MM-DD", async () => {
    expect(today(Date.parse('2026-10-19T23:30:00Z'))).toBe('2026-10-19');
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('in-memory database', () => {
  it('hands out copies, so callers cannot change a table by mutation', async () => {
    const service = db.find('services', 's1');
    service.name = 'Changed';
    expect(db.find('services', 's1').name).toBe('Sick Visit');
    expect(db.find('services', 'nope')).toBeNull();
  });

  it('reset restores the seed rows', async () => {
    db.remove('services', 's1');
    db.reset();
    expect(db.find('services', 's1')).not.toBeNull();
  });

  it('never hands out the same id twice', async () => {
    expect(db.nextId('x')).not.toBe(db.nextId('x'));
  });
});
