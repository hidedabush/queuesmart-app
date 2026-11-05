import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { close, nextId, query, queryOne } from '../../src/database/mysql.js';
import * as queueRepo from '../../src/database/repositories/queueRepo.js';
import * as servicesRepo from '../../src/database/repositories/servicesRepo.js';
import * as userRepo from '../../src/database/repositories/userRepo.js';
import { signalOf } from '../../src/database/signals.js';

// npm run test:mysql: every trigger in src/database/triggers.sql against
// DATABASE_URL, through the same repositories the API uses. Needs
// `npm run db:migrate` first. Only touches the patients and visit types it
// creates and deletes them at the end.
const tag = nextId('trg');
const prefix = `Trigger ${tag}`;
const patients = [];

const newService = (overrides = {}) =>
  servicesRepo.insert({
    name: `${prefix} ${nextId('x')}`,
    description: 'Created by the trigger tests.',
    expectedDuration: 10,
    priority: 'low',
    capacity: 5,
    ...overrides,
  });

const newPatient = async () => {
  const patient = await userRepo.insert({
    name: 'Trigger Test',
    dob: '1990-02-03',
    email: `${nextId('t')}@queuesmart.test`,
    passwordHash: null,
    role: 'user',
  });
  patients.push(patient.id);
  return patient;
};

// One patient checks in, as queueService.joinQueue writes it.
const checkIn = async (service, overrides = {}) =>
  queueRepo.insert({
    userId: (await newPatient()).id,
    serviceId: service.id,
    reason: 'Trigger test',
    status: 'waiting',
    priority: 'normal',
    order: 1,
    arrivedAt: Date.now() - 60_000,
    calledAt: null,
    ...overrides,
  });

// The trigger's code (e.g. 'full'), or the MySQL error code, from a refused write.
const refusedWith = async (promise) => {
  const error = await promise.then(
    () => null,
    (caught) => caught
  );
  expect(error, 'the database should have refused this').not.toBeNull();
  return signalOf(error)?.code ?? error.code;
};

let service;

beforeAll(async () => {
  service = await newService();
});

afterAll(async () => {
  // Patients first: that empties the lines (CASCADE), so the services can go.
  if (patients.length > 0) await query('DELETE FROM user_credentials WHERE id IN (?)', [patients]);
  await query('DELETE FROM services WHERE name LIKE ?', [`${prefix}%`]);
  await close();
});

describe('T1: a new service gets its queue', () => {
  it('open, named queue-<service id>', async () => {
    const queue = await queryOne('SELECT * FROM queues WHERE serviceId = ?', [service.id]);
    expect(queue).toMatchObject({ id: `queue-${service.id}`, status: 'open' });
  });

  it('closed straight away when the service is created closed', async () => {
    const closed = await newService({ isOpen: false });
    expect((await servicesRepo.findById(closed.id)).isOpen).toBe(false);
  });

  it('and a refused service leaves no queue behind', async () => {
    const before = await queryOne('SELECT COUNT(*) AS count FROM queues');
    expect(await refusedWith(newService({ expectedDuration: 500 }))).toBe('ER_CHECK_CONSTRAINT_VIOLATED');
    expect(await queryOne('SELECT COUNT(*) AS count FROM queues')).toEqual(before);
  });
});

describe('T2: changing a service', () => {
  it('capacity cannot drop below the number waiting', async () => {
    const line = await newService({ capacity: 5 });
    await checkIn(line);
    await checkIn(line, { order: 2 });
    await checkIn(line, { order: 3 });

    expect(await refusedWith(servicesRepo.update(line.id, { capacity: 2 }))).toBe('capacity-below-waiting');
    expect((await servicesRepo.update(line.id, { capacity: 3 })).capacity).toBe(3);
  });

  it('its id cannot change', async () => {
    const code = await refusedWith(query('UPDATE services SET id = ? WHERE id = ?', [nextId('s'), service.id]));
    expect(code).toBe('id-locked');
  });
});

describe('T3: deleting a service', () => {
  it('is refused while anyone is waiting or called; once empty it goes with its queue', async () => {
    const line = await newService();
    const entry = await checkIn(line);
    await queueRepo.update(entry.id, { status: 'called', calledAt: Date.now() });
    expect(await refusedWith(servicesRepo.remove(line.id))).toBe('patients-in-line');

    await queueRepo.finish(entry.id, 'served');
    await servicesRepo.remove(line.id);

    expect(await servicesRepo.findById(line.id)).toBeNull();
    expect(await queueRepo.findById(entry.id)).toBeNull();
  });
});

describe('T4: a queue', () => {
  it('cannot move to another service', async () => {
    const other = await newService();
    const code = await refusedWith(
      query('UPDATE queues SET serviceId = ? WHERE serviceId = ?', [other.id, service.id])
    );
    expect(code).toBe('queue-locked');
  });
});

describe('T5: joining a line', () => {
  it('is refused when the line is closed', async () => {
    const closed = await newService({ isOpen: false });
    expect(await refusedWith(checkIn(closed))).toBe('closed');
  });

  it('is refused when waiting + called reach the capacity, as joinQueue counts', async () => {
    const small = await newService({ capacity: 2 });
    const first = await checkIn(small);
    await queueRepo.update(first.id, { status: 'called', calledAt: Date.now() });
    await checkIn(small, { order: 2 });
    expect(await refusedWith(checkIn(small, { order: 3 }))).toBe('full');
  });

  it('lets a finished visit through (demo data, a dump)', async () => {
    const closed = await newService({ isOpen: false });
    const now = Date.now();
    const entry = await checkIn(closed, { status: 'served', calledAt: now - 30_000, leftAt: now });
    expect((await queueRepo.findById(entry.id)).status).toBe('served');
  });
});

describe('T6: moving through the line', () => {
  it('stamps calledAt and leftAt when they are left out', async () => {
    const line = await newService();
    const entry = await checkIn(line);

    await query("UPDATE queue_entries SET status = 'called' WHERE id = ?", [entry.id]);
    const called = await queueRepo.findById(entry.id);
    expect(Math.abs(called.calledAt - Date.now())).toBeLessThan(60_000);

    await query("UPDATE queue_entries SET status = 'served' WHERE id = ?", [entry.id]);
    expect((await queueRepo.findById(entry.id)).leftAt).toBeGreaterThanOrEqual(called.calledAt);
  });

  it('only the called patient can be seen or a no-show', async () => {
    const entry = await checkIn(service);
    expect(await refusedWith(queueRepo.finish(entry.id, 'served'))).toBe('not-called');
    expect(await refusedWith(queueRepo.finish(entry.id, 'no-show'))).toBe('not-called');
    await queueRepo.finish(entry.id, 'canceled');
  });

  it('a finished visit is final', async () => {
    const entry = await checkIn(service);
    await queueRepo.finish(entry.id, 'removed');
    expect(await refusedWith(queueRepo.update(entry.id, { status: 'waiting', leftAt: null }))).toBe('visit-finished');
  });

  it('a visit cannot end before it began', async () => {
    const entry = await checkIn(service);
    expect(await refusedWith(queueRepo.finish(entry.id, 'canceled', entry.arrivedAt - 1000))).toBe('bad-time');
    await queueRepo.finish(entry.id, 'canceled');
  });

  it('a place in line cannot move to another line', async () => {
    const other = await newService();
    const entry = await checkIn(service);
    const code = await refusedWith(
      query('UPDATE queue_entries SET queueId = ? WHERE id = ?', [`queue-${other.id}`, entry.id])
    );
    expect(code).toBe('entry-locked');
    await queueRepo.finish(entry.id, 'canceled');
  });

  it('still lets the front desk reorder and triage waiting patients', async () => {
    const entry = await checkIn(service, { order: 7 });
    expect(await queueRepo.update(entry.id, { order: 3, priority: 'urgent' })).toMatchObject({
      order: 3,
      priority: 'urgent',
    });
    await queueRepo.finish(entry.id, 'canceled');
  });
});

describe('T7: visit history', () => {
  it('cannot be edited', async () => {
    const patient = await newPatient();
    const id = nextId('h');
    await query('INSERT INTO visit_history SET ?', [
      {
        id,
        userId: patient.id,
        serviceId: service.id,
        serviceName: service.name,
        date: '2026-11-04',
        joinedAt: 1,
        calledAt: null,
        leftAt: 2,
        outcome: 'cancelled',
      },
    ]);
    expect(await refusedWith(query("UPDATE visit_history SET outcome = 'seen' WHERE id = ?", [id]))).toBe(
      'history-locked'
    );
  });
});
