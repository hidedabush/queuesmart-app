import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleTables, seedTables } from '../../src/database/seed.js';
import { signalOf } from '../../src/database/signals.js';
import { splitSql } from '../../src/database/sqlFile.js';

// src/database/setup.js (tables, triggers and demo data) with the connection replaced.
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

describe('reading .sql files', () => {
  it('splits on ; and skips comment and blank lines', () => {
    expect(splitSql('-- note\nSELECT 1;\n\n  -- another\nSELECT\n  2;\n')).toEqual(['SELECT 1', 'SELECT\n  2']);
  });

  it('follows DELIMITER, so a trigger body keeps its semicolons', () => {
    const text = [
      'CREATE TABLE t (id INT);',
      'DELIMITER $$',
      'CREATE TRIGGER x BEFORE INSERT ON t FOR EACH ROW',
      'BEGIN',
      '  SET NEW.id = 1;',
      'END$$',
      'DELIMITER ;',
      'SELECT 3;',
    ].join('\r\n');

    expect(splitSql(text)).toEqual([
      'CREATE TABLE t (id INT)',
      'CREATE TRIGGER x BEFORE INSERT ON t FOR EACH ROW\nBEGIN\n  SET NEW.id = 1;\nEND',
      'SELECT 3',
    ]);
  });

  it('keeps a last statement with no delimiter', () => {
    expect(splitSql('SELECT 1')).toEqual(['SELECT 1']);
  });
});

describe('schema', () => {
  it('has one CREATE TABLE per table, without comments', () => {
    const statements = setup.schemaStatements();

    expect(statements).toHaveLength(setup.TABLES.length);
    for (const table of setup.TABLES) {
      expect(statements.some((s) => s.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`))).toBe(true);
    }
    expect(statements.join('\n')).not.toMatch(/^\s*--/m);
  });

  it('creates parents before the tables that point at them, then the triggers', async () => {
    await setup.createTables();

    const sent = sql.query.mock.calls.map(([text]) => text);
    const order = sent.filter((s) => s.startsWith('CREATE TABLE')).map((s) => s.match(/EXISTS (\w+)/)[1]);
    expect(order.indexOf('user_credentials')).toBeLessThan(order.indexOf('user_profiles'));
    expect(order.indexOf('services')).toBeLessThan(order.indexOf('queues'));
    expect(order.indexOf('queues')).toBeLessThan(order.indexOf('queue_entries'));
    expect(sent.findIndex((s) => s.startsWith('DROP TRIGGER'))).toBe(setup.TABLES.length);
  });

  it('drops children first', async () => {
    await setup.dropTables();

    expect(sql.query.mock.calls.map(([text]) => text)).toEqual(
      setup.TABLES.map((table) => `DROP TABLE IF EXISTS ${table}`)
    );
  });

  it('is empty when there are no accounts, and counts every table', async () => {
    sql.queryOne.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 3 });

    expect(await setup.isEmpty()).toBe(true);
    expect(await setup.isEmpty()).toBe(false);

    sql.queryOne.mockResolvedValue({ count: 2 });
    const counted = await setup.counts();
    expect(Object.keys(counted)).toEqual([...setup.TABLES].reverse());
    expect(Object.values(counted).every((count) => count === 2)).toBe(true);
  });
});

describe('triggers', () => {
  it('drops and creates every trigger, so a changed rule replaces the old one', () => {
    const statements = setup.triggerStatements();

    expect(statements).toHaveLength(setup.TRIGGERS.length * 2);
    for (const trigger of setup.TRIGGERS) {
      const drop = statements.indexOf(`DROP TRIGGER IF EXISTS ${trigger}`);
      expect(drop).toBeGreaterThanOrEqual(0);
      expect(statements[drop + 1]).toMatch(new RegExp(`^CREATE TRIGGER ${trigger}\\n`));
      expect(statements[drop + 1]).toMatch(/END$/);
    }
  });

  it('every refusal uses the "<code>|<text>" message the API reads, within MySQL’s 128 characters', () => {
    const messages = setup
      .triggerStatements()
      .join('\n')
      .match(/MESSAGE_TEXT = '[^']+'/g);

    expect(messages.length).toBeGreaterThanOrEqual(9);
    for (const text of messages) {
      const message = text.slice("MESSAGE_TEXT = '".length, -1);
      expect(signalOf({ code: 'ER_SIGNAL_EXCEPTION', sqlMessage: message }).code).toMatch(/^[a-z-]+$/);
      expect(message.length).toBeLessThanOrEqual(128);
    }
  });

  it('never write rows the API writes itself (history, notifications)', () => {
    const body = setup.triggerStatements().join('\n');
    expect(body).not.toMatch(/INSERT INTO (visit_history|notifications)/);
  });

  it('name each queue the way queueIdFor() does', () => {
    expect(setup.queueIdFor('s1')).toBe('queue-s1');
    expect(setup.triggerStatements().join('\n')).toContain("CONCAT('queue-', NEW.id)");
  });

  it('refuse a closed or full line with the same codes as queueService', () => {
    const body = setup.triggerStatements().join('\n');
    expect(body).toContain("'closed|This visit type is not accepting new check-ins.'");
    expect(body).toContain("'full|This visit type has reached its check-in capacity.'");
  });

  it('read a refusal back as its code and message, and ignore other errors', () => {
    expect(signalOf({ code: 'ER_SIGNAL_EXCEPTION', sqlMessage: 'full|This line is full.' })).toEqual({
      code: 'full',
      message: 'This line is full.',
    });
    expect(signalOf({ code: 'ER_SIGNAL_EXCEPTION', message: 'no code here' })).toEqual({
      code: 'conflict',
      message: 'no code here',
    });
    expect(signalOf({ code: 'ER_DUP_ENTRY', sqlMessage: 'full|x' })).toBeNull();
    expect(signalOf(undefined)).toBeNull();
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
    expect(rows.notifications).toEqual([]);
  });

  it('stores a notification’s read flag as A4’s status', () => {
    const rows = setup.toTableRows({
      notifications: [{ id: 'n1', read: true, channels: ['in-app'] }, { id: 'n2', read: false, channels: [] }],
    });
    expect(rows.notifications).toEqual([
      { id: 'n1', status: 'viewed', channels: '["in-app"]' },
      { id: 'n2', status: 'sent', channels: '[]' },
    ]);
  });

  it('stores preferences as JSON text', () => {
    const rows = setup.toTableRows({ users: [{ email: 'a@b.co', name: 'A B', preferences: { sms: true } }] });
    expect(rows.user_profiles[0].preferences).toBe('{"sms":true}');
  });

  it('inserts parents first, skips empty tables, and only sets the status of the queues T1 made', async () => {
    const counts = await setup.insertAll({ services: seedTables().services });

    expect(sql.run.mock.calls[0][0]).toBe('INSERT INTO services (??) VALUES ?');
    expect(sql.run.mock.calls[1][0]).toBe(
      'INSERT INTO queues (??) VALUES ? ON DUPLICATE KEY UPDATE status = VALUES(status)'
    );
    expect(sql.run).toHaveBeenCalledTimes(2);
    expect(counts).toMatchObject({ services: 5, queues: 5, user_credentials: 0 });
  });

  it('adds a finished day of visits for the dashboard', () => {
    const now = Date.parse('2026-11-04T20:00:00Z');
    const sample = sampleTables(now);

    expect(sample.history).toHaveLength(8);
    expect(sample.history.every((row) => row.date === '2026-11-04' && row.leftAt < now)).toBe(true);
    sample.queueEntries.forEach((entry, index) => {
      expect(entry.leftAt).toBe(sample.history[index].leftAt);
      expect(['served', 'no-show', 'canceled', 'removed']).toContain(entry.status);
    });
    expect(new Set(sample.users.map((u) => u.email)).size).toBe(8);
    expect(sample.notifications).toHaveLength(8 + 5);
    expect(sample.notifications.every((row) => row.read && row.entryId.startsWith('q-sample-'))).toBe(true);
  });

  it('db:seed adds the starting rows and the finished day together', () => {
    const now = Date.parse('2026-11-04T20:00:00Z');
    const data = setup.demoData(now);

    expect(data.users).toHaveLength(seedTables().users.length + 8);
    expect(data.history).toHaveLength(3 + 8);
    expect(data.services).toHaveLength(5);
  });
});
