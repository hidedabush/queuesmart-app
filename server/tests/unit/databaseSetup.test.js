import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signalOf } from '../../src/database/signals.js';
import { splitSql } from '../../src/database/sqlFile.js';

// src/database/setup.js (tables and triggers) with the connection replaced.
const sql = vi.hoisted(() => ({ query: vi.fn(), queryOne: vi.fn() }));

vi.mock('../../src/database/mysql.js', () => ({ query: sql.query, queryOne: sql.queryOne }));

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

describe('schema and triggers', () => {
  it('has one CREATE TABLE per table, without comments', () => {
    const statements = setup.schemaStatements();

    expect(statements).toHaveLength(setup.TABLES.length);
    for (const table of setup.TABLES) {
      expect(statements.some((s) => s.startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`))).toBe(true);
    }
    expect(statements.join('\n')).not.toMatch(/^\s*--/m);
  });

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

  it('every refusal in a trigger uses the "<code>|<text>" message the API reads', () => {
    const messages = setup
      .triggerStatements()
      .join('\n')
      .match(/MESSAGE_TEXT = '[^']+'/g);

    expect(messages.length).toBeGreaterThanOrEqual(10);
    for (const text of messages) {
      const message = text.slice("MESSAGE_TEXT = '".length, -1);
      expect(signalOf({ code: 'ER_SIGNAL_EXCEPTION', sqlMessage: message }).code).toMatch(/^[a-z-]+$/);
      expect(message.length).toBeLessThanOrEqual(128);
    }
  });

  it('creates the tables, parents first, then the triggers', async () => {
    await setup.createTables();

    const sent = sql.query.mock.calls.map(([text]) => text);
    const tableOrder = sent.filter((s) => s.startsWith('CREATE TABLE')).map((s) => s.match(/EXISTS (\w+)/)[1]);
    expect(tableOrder).toEqual([...setup.TABLES].reverse());
    const firstTrigger = sent.findIndex((s) => s.startsWith('DROP TRIGGER'));
    expect(firstTrigger).toBe(setup.TABLES.length);
  });

  it('drops children first', async () => {
    await setup.dropTables();

    expect(sql.query.mock.calls.map(([text]) => text)).toEqual(
      setup.TABLES.map((table) => `DROP TABLE IF EXISTS ${table}`)
    );
  });

  it('is empty when there are no visit types, and counts every table', async () => {
    sql.queryOne.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 3 });
    expect(await setup.isEmpty()).toBe(true);
    expect(await setup.isEmpty()).toBe(false);

    sql.queryOne.mockResolvedValue({ count: 2 });
    expect(await setup.counts()).toEqual({ services: 2, queues: 2, queue_entries: 2, visit_history: 2 });
  });

  it('names each queue after its service, as the trigger does', () => {
    expect(setup.queueIdFor('s1')).toBe('queue-s1');
    expect(setup.triggerStatements().join('\n')).toContain("CONCAT('queue-', NEW.id)");
  });
});

describe('trigger refusals', () => {
  it('reads the code and message back, and ignores other errors', () => {
    expect(signalOf({ code: 'ER_SIGNAL_EXCEPTION', sqlMessage: 'full|This line is full for today.' })).toEqual({
      code: 'full',
      message: 'This line is full for today.',
    });
    expect(signalOf({ code: 'ER_SIGNAL_EXCEPTION', message: 'no code here' })).toEqual({
      code: 'conflict',
      message: 'no code here',
    });
    expect(signalOf({ code: 'ER_DUP_ENTRY', sqlMessage: 'full|x' })).toBeNull();
    expect(signalOf(undefined)).toBeNull();
  });
});
