import { describe, expect, it, vi } from 'vitest';
import * as history from '../../src/api/services/historyService.js';
import * as queue from '../../src/api/services/queueService.js';
import * as services from '../../src/api/services/servicesService.js';
import { statsForDate } from '../../src/api/services/statsService.js';
import * as db from '../../src/database/db.js';
import { PATIENT } from '../helpers.js';

const patient = { id: PATIENT.id };

describe('history', () => {
  it('lists only the patient\'s own visits, newest first', () => {
    const rows = history.listForUser(PATIENT.id);
    expect(rows.map((r) => r.date)).toEqual(['2026-09-28', '2026-08-14', '2026-07-02']);
    expect(history.listForUser('u-seed-1')).toEqual([]);
  });

  it('keeps the visit type name after the visit type is deleted', () => {
    services.createService({ name: 'Pop-up Clinic', description: 'x', expectedDuration: 5, priority: 'low' });
    const clinic = services.listServices().find((s) => s.name === 'Pop-up Clinic');
    queue.join(patient, clinic.id, 'Check-up');
    queue.leave(PATIENT.id);
    services.deleteService(clinic.id);
    expect(history.listForUser(PATIENT.id)[0]).toMatchObject({
      serviceName: 'Pop-up Clinic',
      outcome: 'cancelled',
    });
  });

  it('falls back to "Visit" if the visit type is already gone', () => {
    const row = history.record({ userId: 'u1', serviceId: 'gone', arrivedAt: 1 }, 'removed');
    expect(row.serviceName).toBe('Visit');
  });
});

describe('statistics', () => {
  it('counts today\'s outcomes per visit type and the average wait', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T14:00:00Z'));
    db.reset(); // seed patients now arrive from 13:45, one a minute
    queue.join(patient, 's2', 'Small cut'); // arrives 14:00

    vi.setSystemTime(new Date('2026-10-19T14:10:00Z'));
    queue.callNext('s2');
    queue.resolveCalled('s2', 'no-show');
    queue.callNext('s2');
    queue.resolveCalled('s2', 'seen');

    vi.setSystemTime(new Date('2026-10-19T14:30:00Z'));
    queue.callNext('s2');
    queue.resolveCalled('s2', 'seen'); // the patient: waited 30 min

    const injury = statsForDate('2026-10-19').services.find((s) => s.serviceId === 's2');
    expect(injury).toMatchObject({ served: 2, noShows: 1, cancelled: 0, currentlyWaiting: 0 });
    // Seen: Ethan (13:52 -> 14:10 = 18 min) and the patient (30 min).
    expect(injury.averageWaitMinutes).toBe(24);
  });

  it('reports no average when nobody was seen that day', () => {
    const { services: rows } = statsForDate('2001-01-01');
    expect(rows.every((s) => s.served === 0 && s.averageWaitMinutes === null)).toBe(true);
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
