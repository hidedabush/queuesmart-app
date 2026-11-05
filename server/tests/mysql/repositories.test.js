import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { close, nextId, query, queryOne } from '../../src/database/mysql.js';
import * as historyRepo from '../../src/database/repositories/historyRepo.js';
import * as queueRepo from '../../src/database/repositories/queueRepo.js';
import * as servicesRepo from '../../src/database/repositories/servicesRepo.js';
import { signalOf } from '../../src/database/signals.js';

// npm run test:mysql: the real repositories and triggers against
// DATABASE_URL. Needs `npm run db:migrate` first. Only touches visit types it
// creates (named "Test <tag> ...") and deletes them, and their history, at
// the end.
const tag = nextId('test');
const prefix = `Test ${tag}`;

const newService = (overrides = {}) =>
  servicesRepo.insert({
    name: `${prefix} ${nextId('x')}`,
    description: 'Created by the database tests.',
    expectedDuration: 10,
    priority: 'low',
    capacity: 5,
    ...overrides,
  });

// The trigger's code, e.g. 'full', from a refused write.
const refusedWith = async (promise) => {
  const error = await promise.then(
    () => null,
    (caught) => caught
  );
  expect(error, 'the database should have refused this').not.toBeNull();
  return signalOf(error)?.code ?? error.code;
};

const historyOf = (entryId) => queryOne('SELECT * FROM visit_history WHERE entryId = ?', [entryId]);

let service;

beforeAll(async () => {
  service = await newService();
});

afterAll(async () => {
  const mine = await query('SELECT id FROM services WHERE name LIKE ?', [`${prefix}%`]);
  const ids = mine.map((row) => row.id);
  if (ids.length > 0) {
    // Empty the lines first: the delete trigger refuses a line with patients.
    await query(
      `UPDATE queue_entries e JOIN queues q ON q.id = e.queueId
       SET e.status = 'removed', e.leftAt = GREATEST(e.joinedAt, ROUND(UNIX_TIMESTAMP(NOW(3)) * 1000))
       WHERE q.serviceId IN (?) AND e.status IN ('waiting', 'called')`,
      [ids]
    );
    await query('DELETE FROM services WHERE id IN (?)', [ids]);
    await query('DELETE FROM visit_history WHERE serviceId IN (?)', [ids]);
  }
  await close();
});

describe('services and their queue', () => {
  it('a trigger creates an open queue for every new service', async () => {
    const queue = await queryOne('SELECT * FROM queues WHERE serviceId = ?', [service.id]);
    expect(queue).toMatchObject({ id: `queue-${service.id}`, status: 'open' });
    expect((await servicesRepo.findById(service.id)).isOpen).toBe(true);
  });

  it('a service created closed is closed from the start', async () => {
    const closed = await newService({ isOpen: false });
    expect((await servicesRepo.findById(closed.id)).isOpen).toBe(false);
  });

  it('opens and closes through the queue, and updates fields', async () => {
    expect((await servicesRepo.update(service.id, { isOpen: false })).isOpen).toBe(false);
    expect((await servicesRepo.update(service.id, { isOpen: true, capacity: 6 })).capacity).toBe(6);
  });

  it('lists the service and finds its name ignoring case, except the row being edited', async () => {
    expect((await servicesRepo.list()).map((row) => row.id)).toContain(service.id);
    expect((await servicesRepo.findByName(service.name.toUpperCase())).id).toBe(service.id);
    expect(await servicesRepo.findByName(service.name, service.id)).toBeNull();
  });

  it('refuses values outside the column rules', async () => {
    expect(await refusedWith(newService({ expectedDuration: 500 }))).toBe('ER_CHECK_CONSTRAINT_VIOLATED');
    expect(await refusedWith(newService({ capacity: 0 }))).toBe('ER_CHECK_CONSTRAINT_VIOLATED');
    expect(await refusedWith(newService({ name: 'ab' }))).toBe('ER_CHECK_CONSTRAINT_VIOLATED');
    expect(await refusedWith(newService({ priority: 'urgent' }))).toBe('WARN_DATA_TRUNCATED');
    expect(await refusedWith(newService({ name: service.name }))).toBe('ER_DUP_ENTRY');
  });

  it('a refused service leaves no queue behind', async () => {
    const before = await queryOne('SELECT COUNT(*) AS count FROM queues');
    await refusedWith(newService({ name: service.name }));
    expect(await queryOne('SELECT COUNT(*) AS count FROM queues')).toEqual(before);
  });
});

describe('joining a line', () => {
  it('fills in the next position and the arrival time', async () => {
    const line = await newService();
    const first = await queueRepo.join(line.id);
    const second = await queueRepo.join(line.id, { arrivedAt: first.arrivedAt + 1000 });

    expect(first).toMatchObject({ serviceId: line.id, status: 'waiting', order: 1, leftAt: null });
    expect(Math.abs(first.arrivedAt - Date.now())).toBeLessThan(60_000);
    expect(second.order).toBe(2);
    expect((await queueRepo.listWaiting(line.id)).map((row) => row.id)).toEqual([first.id, second.id]);
  });

  it('lists urgent patients first', async () => {
    const line = await newService();
    const normal = await queueRepo.join(line.id);
    const urgent = await queueRepo.join(line.id, { priority: 'urgent' });
    expect((await queueRepo.listWaiting(line.id)).map((row) => row.id)).toEqual([urgent.id, normal.id]);
  });

  it('refuses a closed line', async () => {
    const closed = await newService({ isOpen: false });
    expect(await refusedWith(queueRepo.join(closed.id))).toBe('closed');
  });

  it('refuses a full line', async () => {
    const small = await newService({ capacity: 2 });
    await queueRepo.join(small.id);
    await queueRepo.join(small.id);
    expect(await refusedWith(queueRepo.join(small.id))).toBe('full');
  });

  it('refuses an entry that starts already finished', async () => {
    const code = await refusedWith(
      query('INSERT INTO queue_entries SET ?', [
        { id: nextId('q'), queueId: `queue-${service.id}`, status: 'served', leftAt: Date.now() },
      ])
    );
    expect(code).toBe('not-in-line');
  });

  it('refuses a queue that does not exist', async () => {
    expect(await refusedWith(queueRepo.join('nope'))).toBe('ER_NO_REFERENCED_ROW_2');
  });
});

describe('moving through the line', () => {
  it('call -> seen stamps the times and writes a history row', async () => {
    const line = await newService();
    const entry = await queueRepo.join(line.id, { arrivedAt: Date.now() - 20 * 60_000 });

    const called = await queueRepo.call(entry.id);
    expect(called.status).toBe('called');
    expect(called.calledAt).toBeGreaterThanOrEqual(entry.arrivedAt);
    expect((await queueRepo.findCalled(line.id)).id).toBe(entry.id);

    const finished = await queueRepo.finish(entry.id, 'served');
    expect(finished.leftAt).toBeGreaterThanOrEqual(called.calledAt);
    expect(await queueRepo.findCalled(line.id)).toBeNull();

    expect(await historyOf(entry.id)).toMatchObject({
      id: `h-${entry.id}`,
      serviceId: line.id,
      serviceName: line.name,
      date: new Date(finished.leftAt).toISOString().slice(0, 10),
      joinedAt: entry.arrivedAt,
      calledAt: called.calledAt,
      leftAt: finished.leftAt,
      outcome: 'seen',
    });
  });

  it('maps every way out of the line to its history outcome', async () => {
    const line = await newService({ capacity: 10 });
    const outcomes = { canceled: 'cancelled', removed: 'removed' };
    for (const [status, outcome] of Object.entries(outcomes)) {
      const entry = await queueRepo.join(line.id);
      await queueRepo.finish(entry.id, status);
      expect((await historyOf(entry.id)).outcome).toBe(outcome);
    }
    const noShow = await queueRepo.join(line.id);
    await queueRepo.call(noShow.id);
    await queueRepo.finish(noShow.id, 'no-show');
    expect((await historyOf(noShow.id)).outcome).toBe('no-show');
  });

  it('allows one called patient per queue', async () => {
    const line = await newService();
    const [first, second] = [await queueRepo.join(line.id), await queueRepo.join(line.id)];
    await queueRepo.call(first.id);
    expect(await refusedWith(queueRepo.call(second.id))).toBe('ER_DUP_ENTRY');
  });

  it('only the called patient can be seen or a no-show', async () => {
    const line = await newService();
    const entry = await queueRepo.join(line.id);
    expect(await refusedWith(queueRepo.finish(entry.id, 'served'))).toBe('not-called');
    expect(await refusedWith(queueRepo.finish(entry.id, 'no-show'))).toBe('not-called');
    expect(await historyOf(entry.id)).toBeNull();
  });

  it('a finished visit is final', async () => {
    const line = await newService();
    const entry = await queueRepo.join(line.id);
    await queueRepo.finish(entry.id, 'canceled');
    expect(await refusedWith(queueRepo.call(entry.id))).toBe('visit-finished');
    expect(await refusedWith(queueRepo.finish(entry.id, 'removed'))).toBe('visit-finished');
  });

  it('refuses a visit that ends before it began', async () => {
    const line = await newService();
    const entry = await queueRepo.join(line.id);
    expect(await refusedWith(queueRepo.finish(entry.id, 'canceled', entry.arrivedAt - 1000))).toBe('bad-time');
  });

  it('a place in line cannot move to another line', async () => {
    const [a, b] = [await newService(), await newService()];
    const entry = await queueRepo.join(a.id);
    const code = await refusedWith(
      query('UPDATE queue_entries SET queueId = ? WHERE id = ?', [`queue-${b.id}`, entry.id])
    );
    expect(code).toBe('entry-locked');
  });
});

describe('rules on services that depend on the line', () => {
  it('capacity cannot drop below the number waiting', async () => {
    const line = await newService({ capacity: 5 });
    await queueRepo.join(line.id);
    await queueRepo.join(line.id);
    await queueRepo.join(line.id);

    expect(await refusedWith(servicesRepo.update(line.id, { capacity: 2 }))).toBe('capacity-below-waiting');
    expect((await servicesRepo.update(line.id, { capacity: 3 })).capacity).toBe(3);
  });

  it('a service with patients in line cannot be deleted; once empty it goes with its queue', async () => {
    const line = await newService();
    const entry = await queueRepo.join(line.id);
    await queueRepo.call(entry.id);
    expect(await refusedWith(servicesRepo.remove(line.id))).toBe('patients-in-line');

    await queueRepo.finish(entry.id, 'served');
    await servicesRepo.remove(line.id);

    expect(await servicesRepo.findById(line.id)).toBeNull();
    expect(await queueRepo.findById(entry.id)).toBeNull();
    // The day's numbers survive the visit type.
    expect((await historyOf(entry.id)).serviceName).toBe(line.name);
  });

  it('a queue cannot move to another service', async () => {
    const other = await newService();
    const code = await refusedWith(
      query('UPDATE queues SET serviceId = ? WHERE serviceId = ?', [other.id, service.id])
    );
    expect(code).toBe('queue-locked');
  });
});

describe('visit history', () => {
  it('is read by date for the statistics', async () => {
    const line = await newService();
    const entry = await queueRepo.join(line.id);
    const { leftAt } = await queueRepo.finish(entry.id, 'canceled');
    const date = new Date(leftAt).toISOString().slice(0, 10);

    expect((await historyRepo.listByDate(date)).map((row) => row.entryId)).toContain(entry.id);
  });

  it('cannot be edited', async () => {
    const line = await newService();
    const entry = await queueRepo.join(line.id);
    await queueRepo.finish(entry.id, 'canceled');
    const code = await refusedWith(
      query("UPDATE visit_history SET outcome = 'seen' WHERE entryId = ?", [entry.id])
    );
    expect(code).toBe('history-locked');
  });
});
