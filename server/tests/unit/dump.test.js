import { describe, expect, it, vi } from 'vitest';
import { splitSql } from '../../src/database/sqlFile.js';

// src/database/dumpSql.js with the connection replaced.
const sql = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../../src/database/mysql.js', () => ({ query: sql.query, queryOne: vi.fn() }));

const { buildDump, insertStatements, readTables, sqlValue } = await import('../../src/database/dumpSql.js');
const { TABLES, TRIGGERS } = await import('../../src/database/setup.js');

const tables = {
  services: [{ id: 's1', name: "Kid's Visit", capacity: 5 }],
  queues: [{ id: 'queue-s1', serviceId: 's1', status: 'open', createdAt: '2026-11-04 10:00:00.000' }],
  queue_entries: [{ id: 'q1', queueId: 'queue-s1', position: 1, calledAt: null }],
  visit_history: [],
};

describe('database dump', () => {
  it('escapes values and quotes names', () => {
    const [statement] = insertStatements('services', tables.services);
    expect(statement).toBe("INSERT INTO `services` (`id`, `name`, `capacity`) VALUES\n  ('s1', 'Kid\\'s Visit', 5)");
    expect(insertStatements('queue_entries', tables.queue_entries)[0]).toContain("('q1', 'queue-s1', 1, NULL)");
    expect(insertStatements('visit_history', [])).toEqual([]);
  });

  it('writes JSON columns back as JSON text', () => {
    // MySQL reads \" inside a quoted string back as ".
    expect(sqlValue(['in-app', 'sms'])).toBe(String.raw`'[\"in-app\",\"sms\"]'`);
    expect(sqlValue({ sms: true })).toBe(String.raw`'{\"sms\":true}'`);
    expect(sqlValue(null)).toBe('NULL');
    expect(sqlValue(5)).toBe('5');
  });

  it('splits big tables into several INSERTs', () => {
    const rows = Array.from({ length: 450 }, (_, i) => ({ id: `q${i}` }));
    expect(insertStatements('queue_entries', rows)).toHaveLength(3);
  });

  it('drops, creates, fills, then adds the triggers last', () => {
    const text = buildDump(tables, { createdAt: new Date('2026-11-04T12:00:00Z') });
    const statements = splitSql(text);

    expect(text).toContain('at 2026-11-04T12:00:00.000Z');
    expect(text).toContain('--   services: 1 rows');
    expect(statements.slice(0, TABLES.length)).toEqual(TABLES.map((t) => `DROP TABLE IF EXISTS \`${t}\``));

    const index = (pattern) => statements.findIndex((s) => pattern.test(s));
    const lastCreate = statements.findLastIndex((s) => s.startsWith('CREATE TABLE'));
    expect(index(/^INSERT INTO `services`/)).toBeGreaterThan(lastCreate);
    expect(index(/^INSERT INTO `queues`/)).toBeGreaterThan(index(/^INSERT INTO `services`/));
    expect(index(/^INSERT INTO `queue_entries`/)).toBeGreaterThan(index(/^INSERT INTO `queues`/));
    expect(index(/^DROP TRIGGER/)).toBeGreaterThan(index(/^INSERT INTO `queue_entries`/));
    expect(statements.filter((s) => s.startsWith('CREATE TRIGGER'))).toHaveLength(TRIGGERS.length);
  });

  it('reads every stored column of every table, parents first', async () => {
    sql.query.mockImplementation(async (text, params) =>
      text.includes('information_schema') ? [{ name: 'id' }] : [{ id: params[1] }]
    );

    const read = await readTables();

    expect(Object.keys(read)).toEqual([...TABLES].reverse());
    expect(read.user_credentials).toEqual([{ id: 'user_credentials' }]);
    expect(sql.query.mock.calls[0][0]).toContain("EXTRA NOT LIKE '%GENERATED%'");
    expect(sql.query.mock.calls[1]).toEqual(['SELECT ?? FROM ?? ORDER BY 1', [['id'], 'user_credentials']]);
  });
});
