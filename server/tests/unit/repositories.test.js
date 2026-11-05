import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real SQL repositories with the connection replaced: checks which
// table and values each call sends, and how rows come back. tests/mysql/
// runs the same repositories (and the triggers) against a real database.
const sql = vi.hoisted(() => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(),
}));

vi.mock('../../src/database/mysql.js', () => ({
  query: sql.query,
  queryOne: sql.queryOne,
  nextId: (prefix) => `${prefix}-new`,
  transaction: (work) => work(sql.run),
}));

const historyRepo = await import('../../src/database/repositories/historyRepo.js');
const queueRepo = await import('../../src/database/repositories/queueRepo.js');
const servicesRepo = await import('../../src/database/repositories/servicesRepo.js');

// The SQL text and values of one call to query/queryOne/run.
const call = (mock, index = 0) => {
  const [text, params] = mock.mock.calls[index];
  return { text: text.replace(/\s+/g, ' ').trim(), params };
};

beforeEach(() => {
  sql.query.mockReset().mockResolvedValue([]);
  sql.queryOne.mockReset().mockResolvedValue(null);
  sql.run.mockReset().mockResolvedValue({});
});

describe('servicesRepo', () => {
  const row = { id: 's1', name: 'Sick Visit', isOpen: 1 };

  it('turns the queue status into a boolean isOpen', async () => {
    sql.query.mockResolvedValue([row, { ...row, id: 's2', isOpen: 0 }]);

    const services = await servicesRepo.list();

    expect(services.map((s) => s.isOpen)).toEqual([true, false]);
    expect(call(sql.query).text).toContain("q.status = 'open' AS isOpen");
  });

  it('returns null for a missing service', async () => {
    expect(await servicesRepo.findById('nope')).toBeNull();
    expect(call(sql.queryOne).params).toEqual(['nope']);
  });

  it('can skip the row being edited when checking a name', async () => {
    await servicesRepo.findByName(' Sick Visit ');
    await servicesRepo.findByName('Sick Visit', 's1');

    expect(call(sql.queryOne, 0).params).toEqual(['Sick Visit', null, null]);
    expect(call(sql.queryOne, 1).params).toEqual(['Sick Visit', 's1', 's1']);
  });

  it('inserts only the service; the trigger makes its open queue', async () => {
    const draft = { name: 'Allergy Shots', description: 'Shots.', expectedDuration: 10, priority: 'low', capacity: 5 };

    const created = await servicesRepo.insert(draft);

    expect(created).toEqual({ ...draft, id: 's-new', isOpen: true });
    expect(sql.run).toHaveBeenCalledTimes(1);
    expect(call(sql.run)).toEqual({ text: 'INSERT INTO services SET ?', params: [{ ...draft, id: 's-new' }] });
  });

  it('closes a service created closed in the same transaction', async () => {
    const created = await servicesRepo.insert({ name: 'Allergy Shots', isOpen: false });

    expect(created.isOpen).toBe(false);
    expect(call(sql.run, 1)).toEqual({
      text: "UPDATE queues SET status = 'closed' WHERE serviceId = ?",
      params: ['s-new'],
    });
  });

  it('sends service fields and isOpen to their own tables', async () => {
    sql.queryOne.mockResolvedValue(row);

    const updated = await servicesRepo.update('s1', { capacity: 9, isOpen: false });

    expect(call(sql.query, 0)).toEqual({
      text: 'UPDATE services SET ? WHERE id = ?',
      params: [{ capacity: 9 }, 's1'],
    });
    expect(call(sql.query, 1)).toEqual({
      text: 'UPDATE queues SET status = ? WHERE serviceId = ?',
      params: ['closed', 's1'],
    });
    expect(updated.isOpen).toBe(true);
  });

  it('only touches the queue when just isOpen changes', async () => {
    await servicesRepo.update('s1', { isOpen: true });

    expect(sql.query).toHaveBeenCalledTimes(1);
    expect(call(sql.query).params).toEqual(['open', 's1']);
  });

  it('deletes by id', async () => {
    await servicesRepo.remove('s1');
    expect(call(sql.query)).toEqual({ text: 'DELETE FROM services WHERE id = ?', params: ['s1'] });
  });
});

describe('queueRepo', () => {
  it('renames position and joinedAt to the API names', async () => {
    await queueRepo.findById('q1');
    expect(call(sql.queryOne).text).toContain('e.position AS `order`, e.joinedAt AS arrivedAt');
  });

  it('lists only patients still in line, in arrival order', async () => {
    await queueRepo.listByService('s1');
    const { text, params } = call(sql.query);
    expect(text).toContain("e.status IN ('waiting', 'called')");
    expect(text).toMatch(/ORDER BY e\.position$/);
    expect(params).toEqual(['s1']);
  });

  it('lists the waiting urgent first, and finds the called patient', async () => {
    await queueRepo.listWaiting('s1');
    await queueRepo.findCalled('s1');

    expect(call(sql.query).text).toContain("e.status = 'waiting'");
    expect(call(sql.query).text).toMatch(/ORDER BY e\.priority = 'urgent' DESC, e\.position$/);
    expect(call(sql.queryOne, 0).text).toContain("e.status = 'called'");
  });

  it('joins the queue of a service and leaves the rest to the trigger', async () => {
    sql.queryOne.mockResolvedValue({ id: 'q-new', order: 3 });

    expect(await queueRepo.join('s1')).toEqual({ id: 'q-new', order: 3 });
    expect(call(sql.query)).toEqual({
      text: 'INSERT INTO queue_entries SET ?',
      params: [{ id: 'q-new', queueId: 'queue-s1', priority: 'normal', joinedAt: 0 }],
    });
    expect(call(sql.queryOne).params).toEqual(['q-new']);

    await queueRepo.join('s2', { priority: 'urgent', arrivedAt: 5000 });
    expect(call(sql.query, 1).params[0]).toMatchObject({ queueId: 'queue-s2', priority: 'urgent', joinedAt: 5000 });
  });

  it('calls a patient, with the time stamped by the trigger unless given', async () => {
    await queueRepo.call('q1');
    await queueRepo.call('q1', 7000);

    expect(call(sql.query, 0)).toEqual({
      text: "UPDATE queue_entries SET status = 'called', calledAt = ? WHERE id = ?",
      params: [null, 'q1'],
    });
    expect(call(sql.query, 1).params).toEqual([7000, 'q1']);
  });

  it('keeps a finished entry with its status and time', async () => {
    await queueRepo.finish('q1', 'served', 5000);
    await queueRepo.finish('q1', 'canceled');

    expect(call(sql.query, 0)).toEqual({
      text: 'UPDATE queue_entries SET status = ?, leftAt = ? WHERE id = ?',
      params: ['served', 5000, 'q1'],
    });
    expect(call(sql.query, 1).params).toEqual(['canceled', null, 'q1']);
  });
});

describe('historyRepo', () => {
  it('reads one day', async () => {
    await historyRepo.listByDate('2026-11-01');

    expect(call(sql.query)).toEqual({
      text: 'SELECT * FROM visit_history WHERE date = ?',
      params: ['2026-11-01'],
    });
  });
});
