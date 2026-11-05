import { describe, expect, it } from 'vitest';
import * as db from '../fakes/db.js';
import { listMine, recordOutcome } from '../../src/api/services/historyService.js';

// A queue entry as the queue code passes it, just before it is removed.
const leavingEntry = (overrides = {}) => ({
  id: 'q-test',
  userId: 'u-patient',
  serviceId: 's1',
  reason: 'Private reason',
  arrivedAt: Date.now() - 20 * 60_000,
  calledAt: null,
  ...overrides,
});

describe('recordOutcome', () => {
  it('copies the visit details into a history row', async () => {
    const calledAt = Date.now() - 5 * 60_000;
    const row = await recordOutcome(leavingEntry({ calledAt }), 'seen');

    expect(row).toMatchObject({
      userId: 'u-patient',
      serviceId: 's1',
      serviceName: 'Sick Visit',
      calledAt,
      outcome: 'seen',
      date: new Date(row.leftAt).toISOString().slice(0, 10),
    });
    expect(row).not.toHaveProperty('reason');
  });

  it('still reads correctly when the visit type was deleted', async () => {
    db.remove('services', 's1');

    expect((await recordOutcome(leavingEntry(), 'removed')).serviceName).toBe('Visit');
  });

  it('defaults a missing calledAt to null', async () => {
    const { calledAt, ...neverCalled } = leavingEntry();
    void calledAt;

    expect((await recordOutcome(neverCalled, 'cancelled')).calledAt).toBeNull();
  });

  it('refuses an outcome it does not know', async () => {
    await expect(recordOutcome(leavingEntry(), 'finished')).rejects.toThrow(
      'Unknown history outcome: finished'
    );
  });
});

describe('listMine', () => {
  it("returns only the caller's rows, newest first", async () => {
    await recordOutcome(leavingEntry(), 'cancelled');
    await recordOutcome(leavingEntry({ userId: 'u-someone-else' }), 'seen');

    const { history } = await listMine('u-patient');

    // The new row, then the three seeded visits from newest to oldest.
    expect(history.map((row) => row.outcome)).toEqual(['cancelled', 'seen', 'seen', 'cancelled']);
    expect(history.map((row) => row.date).slice(1)).toEqual(['2026-09-28', '2026-08-14', '2026-07-02']);
  });

  it('leaves out internal fields', async () => {
    const [row] = (await listMine('u-patient')).history;

    expect(Object.keys(row).sort()).toEqual(
      ['date', 'id', 'joinedAt', 'leftAt', 'outcome', 'serviceId', 'serviceName'].sort()
    );
  });

  it('is empty for a patient with no visits', async () => {
    expect(await listMine('u-new')).toEqual({ history: [] });
  });
});
