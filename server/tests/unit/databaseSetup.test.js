import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleTables, seedTables } from '../../src/database/seed.js';

// src/database/setup.js (tables and demo data) with the connection replaced.
const sql = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn(), run: vi.fn() }));

vi.mock('../../src/database/mysql.js', () => ({
  query: sql.query,
  queryOne: sql.queryOne,
  transaction: (work) => work(sql.run),
}));

const setup = await import('../../src/database/setup.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('schema', () => {
  it('has one CREATE TABLE per table, without comments', () => {
    const statements = setup.schemaStatements();

    expect(statements).toHaveLength(setup.TABLES.length);
    for (const table of setup.TABLES) {
      expect(statements.some((s) => s.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`))).toBe(true);
    }
    expect(statements.join('\n')).not.toContain('--');
  });

  it('creates parents before the tables that point at them', async () => {
    await setup.createTables();

    const order = sql.query.mock.calls.map(([text]) => text.match(/EXISTS (\w+)/)[1]);
    expect(order.indexOf('user_credentials')).toBeLessThan(order.indexOf('user_profiles'));
    expect(order.indexOf('services')).toBeLessThan(order.indexOf('queues'));
    expect(order.indexOf('queues')).toBeLessThan(order.indexOf('queue_entries'));
  });

  it('drops children first', async () => {
    await setup.dropTables();

    expect(sql.query.mock.calls.map(([text]) => text)).toEqual(
      setup.TABLES.map((table) => `DROP TABLE IF EXISTS ${table}`)
    );
  });

  it('is empty when there are no accounts', async () => {
    sql.queryOne.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 3 });

    expect(await setup.isEmpty()).toBe(true);
    expect(await setup.isEmpty()).toBe(false);
  });
});

describe('demo data', () => {
  it('splits users, services and entries into their tables', () => {
    const rows = setup.toTableRows(seedTables());
    const patient = rows.user_profiles.find((p) => p.email === 'patient@queuesmart.test');

    expect(rows.user_credentials[0]).toEqual({
      id: 'u-admin',
      email: 'admin@queuesmart.test',
      passwordHash: expect.stringMatching(/^[^:]+:[a-f0-9]{128}$/),
      role: 'admin',
    });
    expect(patient).toEqual({
      email: 'patient@queuesmart.test',
      fullName: 'Demo Patient',
      dob: '1995-03-14',
      phone: '7135550101',
      preferences: null,
    });
    expect(rows.services[0]).not.toHaveProperty('isOpen');
    expect(rows.queues.find((q) => q.serviceId === 's5')).toEqual({
      id: 'queue-s5',
      serviceId: 's5',
      status: 'closed',
    });
    expect(rows.queue_entries[0]).toMatchObject({
      id: 'q-seed-1',
      queueId: 'queue-s1',
      position: 1,
      joinedAt: expect.any(Number),
      leftAt: null,
    });
    expect(rows.visit_history).toHaveLength(3);
    expect(rows.notifications).toHaveLength(2);
  });

  it('stores preferences as JSON text', () => {
    const rows = setup.toTableRows({ users: [{ email: 'a@b.co', name: 'A B', preferences: { sms: true } }] });
    expect(rows.user_profiles[0].preferences).toBe('{"sms":true}');
  });

  it('inserts parents first and skips empty tables', async () => {
    const counts = await setup.insertAll({ services: seedTables().services });

    expect(sql.run.mock.calls.map(([, [columns]]) => columns.includes('serviceId'))).toEqual([false, true]);
    expect(sql.run.mock.calls[0][0]).toBe('INSERT INTO services (??) VALUES ?');
    expect(sql.run.mock.calls[1][0]).toBe('INSERT INTO queues (??) VALUES ?');
    expect(counts).toMatchObject({ services: 5, queues: 5, user_credentials: 0 });
  });

  it('adds a finished day of visits for the dashboard', () => {
    const now = Date.parse('2026-11-04T20:00:00Z');
    const sample = sampleTables(now);

    expect(sample.history).toHaveLength(8);
    expect(sample.history.every((row) => row.date === '2026-11-04' && row.leftAt < now)).toBe(true);
    // Each finished entry matches its history row.
    sample.queueEntries.forEach((entry, index) => {
      expect(entry.leftAt).toBe(sample.history[index].leftAt);
      expect(['served', 'no-show', 'canceled', 'removed']).toContain(entry.status);
    });
    expect(new Set(sample.users.map((u) => u.email)).size).toBe(8);
  });
});
