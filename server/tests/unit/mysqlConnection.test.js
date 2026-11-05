import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// src/database/mysql.js with mysql2 replaced by a fake pool.
const fake = vi.hoisted(() => {
  const connection = {
    query: vi.fn(),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
  const pool = {
    query: vi.fn(),
    getConnection: vi.fn(async () => connection),
    end: vi.fn(),
  };
  return { connection, pool, createPool: vi.fn(() => pool) };
});

vi.mock('mysql2/promise', () => ({ default: { createPool: fake.createPool } }));

const DATABASE_URL = 'mysql://u:p@localhost:3306/queuesmart';

async function load() {
  vi.resetModules();
  return import('../../src/database/mysql.js');
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DATABASE_URL = DATABASE_URL;
});

afterEach(() => {
  delete process.env.DATABASE_URL;
});

describe('mysql connection', () => {
  it('refuses to start without DATABASE_URL', async () => {
    delete process.env.DATABASE_URL;
    await expect(load()).rejects.toThrow('DATABASE_URL is not set');
  });

  it('connects with DATABASE_URL and keeps dates as text', async () => {
    await load();

    expect(fake.createPool.mock.calls[0][0]).toEqual({
      uri: DATABASE_URL,
      connectionLimit: 5,
      dateStrings: true,
    });
  });

  it('returns rows, or the first row', async () => {
    const db = await load();
    fake.pool.query.mockResolvedValue([[{ id: 'a' }, { id: 'b' }], []]);

    expect(await db.query('SELECT 1', [1])).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(await db.queryOne('SELECT 1')).toEqual({ id: 'a' });
    expect(fake.pool.query).toHaveBeenCalledWith('SELECT 1', [1]);

    fake.pool.query.mockResolvedValue([[], []]);
    expect(await db.queryOne('SELECT 1')).toBeNull();
  });

  it('makes ids that start with the prefix and do not repeat', async () => {
    const { nextId } = await load();
    const ids = new Set(Array.from({ length: 50 }, () => nextId('q')));

    expect(ids.size).toBe(50);
    expect([...ids].every((id) => /^q[a-z0-9]+$/.test(id) && id.length <= 40)).toBe(true);
  });

  it('commits a transaction that finishes', async () => {
    const { transaction } = await load();
    fake.connection.query.mockResolvedValue([{ affectedRows: 1 }]);

    const result = await transaction(async (run) => {
      await run('INSERT 1', ['a']);
      return 'done';
    });

    expect(result).toBe('done');
    expect(fake.connection.query).toHaveBeenCalledWith('INSERT 1', ['a']);
    expect(fake.connection.commit).toHaveBeenCalled();
    expect(fake.connection.rollback).not.toHaveBeenCalled();
    expect(fake.connection.release).toHaveBeenCalled();
  });

  it('rolls back a transaction that throws', async () => {
    const { transaction } = await load();

    await expect(
      transaction(async () => {
        throw new Error('second insert failed');
      })
    ).rejects.toThrow('second insert failed');

    expect(fake.connection.rollback).toHaveBeenCalled();
    expect(fake.connection.commit).not.toHaveBeenCalled();
    expect(fake.connection.release).toHaveBeenCalled();
  });

  it('closes the pool', async () => {
    const { close } = await load();
    await close();
    expect(fake.pool.end).toHaveBeenCalled();
  });
});
