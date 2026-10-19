import { describe, expect, it } from 'vitest';
import { statsForDate, today } from '../../src/api/services/statsService.js';
import * as db from '../../src/database/db.js';
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
  it("counts the day's outcomes per visit type and the average wait", () => {
    visit('s2', 'seen', { joined: '14:00', called: '14:18' }); // 18 min
    visit('s2', 'seen', { joined: '14:00', called: '14:30' }); // 30 min
    visit('s2', 'no-show');
    visit('s2', 'cancelled');
    visit('s2', 'removed');

    const injury = statsForDate('2026-10-19').services.find((s) => s.serviceId === 's2');
    expect(injury).toMatchObject({
      served: 2,
      noShows: 1,
      cancelled: 1,
      removed: 1,
      currentlyWaiting: 2,
      averageWaitMinutes: 24,
    });
  });

  it('includes everyone currently waiting', () => {
    addToLine('s5');
    const refill = statsForDate('2026-10-19').services.find((s) => s.serviceId === 's5');
    expect(refill.currentlyWaiting).toBe(1);
  });

  it('reports no average when nobody was seen that day', () => {
    const { services: rows } = statsForDate('2001-01-01');
    expect(rows.every((s) => s.served === 0 && s.averageWaitMinutes === null)).toBe(true);
  });

  it("today is the UTC date as YYYY-MM-DD", () => {
    expect(today(Date.parse('2026-10-19T23:30:00Z'))).toBe('2026-10-19');
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('in-memory database', () => {
  it('hands out copies, so callers cannot change a table by mutation', () => {
    const service = db.find('services', 's1');
    service.name = 'Changed';
    expect(db.find('services', 's1').name).toBe('Sick Visit');
    expect(db.find('services', 'nope')).toBeNull();
  });

  it('reset restores the seed rows', () => {
    db.remove('services', 's1');
    db.reset();
    expect(db.find('services', 's1')).not.toBeNull();
  });

  it('never hands out the same id twice', () => {
    expect(db.nextId('x')).not.toBe(db.nextId('x'));
  });
});
