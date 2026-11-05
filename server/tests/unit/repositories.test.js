import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real SQL repositories with the connection replaced: checks which
// table and values each call sends, and how rows come back. tests/mysql/
// runs the same repositories against a real database.
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
const notificationRepo = await import('../../src/database/repositories/notificationRepo.js');
const queueRepo = await import('../../src/database/repositories/queueRepo.js');
const servicesRepo = await import('../../src/database/repositories/servicesRepo.js');
const userRepo = await import('../../src/database/repositories/userRepo.js');

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

describe('userRepo', () => {
  it('reads credentials and profile together', async () => {
    sql.queryOne.mockResolvedValue({ id: 'u1', name: 'Ana Diaz' });

    expect(await userRepo.findById('u1')).toEqual({ id: 'u1', name: 'Ana Diaz' });
    const { text, params } = call(sql.queryOne);
    expect(text).toContain('FROM user_credentials c JOIN user_profiles p ON p.email = c.email');
    expect(text).toContain('p.fullName AS name');
    expect(text).toMatch(/WHERE c\.id = \?$/);
    expect(params).toEqual(['u1']);
  });

  it('looks up an email without surrounding spaces', async () => {
    await userRepo.findByEmail('  ana@example.com ');
    expect(call(sql.queryOne).params).toEqual(['ana@example.com']);
  });

  it('writes a new user to both tables in one transaction', async () => {
    const user = await userRepo.insert({
      name: 'Ana Diaz',
      dob: '1990-01-01',
      email: 'ana@example.com',
      passwordHash: 'salt:hash',
      role: 'user',
    });

    expect(user).toEqual({
      id: 'u-new',
      name: 'Ana Diaz',
      dob: '1990-01-01',
      email: 'ana@example.com',
      phone: null,
      passwordHash: 'salt:hash',
      role: 'user',
    });
    expect(call(sql.run, 0)).toEqual({
      text: 'INSERT INTO user_credentials SET ?',
      params: [{ id: 'u-new', email: 'ana@example.com', passwordHash: 'salt:hash', role: 'user' }],
    });
    expect(call(sql.run, 1)).toEqual({
      text: 'INSERT INTO user_profiles SET ?',
      params: [{ email: 'ana@example.com', fullName: 'Ana Diaz', dob: '1990-01-01', phone: null }],
    });
  });

  it('changes only the password hash', async () => {
    await userRepo.setPasswordHash('u1', 'new:hash');
    expect(call(sql.query)).toEqual({
      text: 'UPDATE user_credentials SET passwordHash = ? WHERE id = ?',
      params: ['new:hash', 'u1'],
    });
  });
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

  it('creates the service and its queue together', async () => {
    const draft = { name: 'Allergy Shots', description: 'Shots.', expectedDuration: 10, priority: 'low', capacity: 5 };

    const created = await servicesRepo.insert({ ...draft, isOpen: false });

    expect(created).toEqual({ ...draft, id: 's-new', isOpen: false });
    expect(call(sql.run, 0).params).toEqual([{ ...draft, id: 's-new' }]);
    expect(call(sql.run, 1)).toEqual({
      text: 'INSERT INTO queues SET ?',
      params: [{ id: 'queue-new', serviceId: 's-new', status: 'closed' }],
    });
  });

  it('opens a new service by default', async () => {
    await servicesRepo.insert({ name: 'Allergy Shots' });
    expect(call(sql.run, 1).params[0].status).toBe('open');
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

  it('has separate reads for waiting, called and a patient’s active entry', async () => {
    await queueRepo.listWaiting('s1');
    await queueRepo.findCalled('s1');
    await queueRepo.findActiveByUser('u1');

    expect(call(sql.query).text).toContain("e.status = 'waiting'");
    expect(call(sql.queryOne, 0).text).toContain("e.status = 'called'");
    expect(call(sql.queryOne, 1)).toMatchObject({ params: ['u1'] });
  });

  it('adds an entry to the queue of its service', async () => {
    const entry = {
      userId: 'u1',
      serviceId: 's1',
      reason: 'Cough',
      status: 'waiting',
      priority: 'normal',
      order: 3,
      arrivedAt: 1000,
      calledAt: null,
    };

    expect(await queueRepo.insert(entry)).toEqual({ ...entry, id: 'q-new', leftAt: null });

    const { text, params } = call(sql.query);
    expect(text).toBe('INSERT INTO queue_entries (??, queueId) SELECT ?, id FROM queues WHERE serviceId = ?');
    const [columns, values, serviceId] = params;
    expect(Object.fromEntries(columns.map((column, i) => [column, values[i]]))).toEqual({
      id: 'q-new',
      userId: 'u1',
      reason: 'Cough',
      status: 'waiting',
      priority: 'normal',
      position: 3,
      joinedAt: 1000,
      calledAt: null,
    });
    expect(serviceId).toBe('s1');
  });

  it('maps API names back to columns on update', async () => {
    await queueRepo.update('q1', { order: 2, status: 'called' });

    expect(call(sql.query).params).toEqual([{ position: 2, status: 'called' }, 'q1']);
    expect(call(sql.queryOne).params).toEqual(['q1']);
  });

  it('keeps a finished entry with its status and time', async () => {
    await queueRepo.finish('q1', 'served', 5000);
    expect(call(sql.query)).toEqual({
      text: 'UPDATE queue_entries SET status = ?, leftAt = ? WHERE id = ?',
      params: ['served', 5000, 'q1'],
    });
  });

  it('stamps the finish time when none is given', async () => {
    await queueRepo.finish('q1', 'canceled');
    expect(call(sql.query).params[1]).toEqual(expect.any(Number));
  });
});

describe('historyRepo', () => {
  it('reads by date and by patient, newest first', async () => {
    await historyRepo.listByDate('2026-11-01');
    await historyRepo.listByUser('u1');

    expect(call(sql.query, 0)).toEqual({
      text: 'SELECT * FROM visit_history WHERE date = ?',
      params: ['2026-11-01'],
    });
    expect(call(sql.query, 1).text).toMatch(/ORDER BY leftAt DESC$/);
  });

  it('writes a row with a new id', async () => {
    const row = await historyRepo.insert({ userId: 'u1', outcome: 'seen' });
    expect(row).toEqual({ id: 'h-new', userId: 'u1', outcome: 'seen' });
    expect(call(sql.query).params).toEqual([row]);
  });
});

describe('notificationRepo', () => {
  const sent = {
    userId: 'u1',
    type: 'called',
    title: 'Sick Visit: it’s your turn',
    message: 'Please come to the front desk now.',
    serviceId: 's1',
    entryId: 'q1',
    read: false,
    createdAt: 1000,
    channels: ['in-app', 'sms'],
  };

  it('stores read as A4’s status and channels as JSON', async () => {
    const row = await notificationRepo.insert(sent);

    expect(row).toEqual({ ...sent, id: 'n-new' });
    const [stored] = call(sql.query).params;
    expect(stored).toMatchObject({ id: 'n-new', status: 'sent', channels: '["in-app","sms"]' });
    expect(stored).not.toHaveProperty('read');
  });

  it('reads status back as a boolean read', async () => {
    sql.query.mockResolvedValue([{ id: 'n1', read: 1 }, { id: 'n2', read: 0 }]);

    const rows = await notificationRepo.listByUser('u1');

    expect(rows.map((row) => row.read)).toEqual([true, false]);
    expect(call(sql.query).text).toContain("status = 'viewed' AS `read`");
    expect(call(sql.query).text).toMatch(/ORDER BY createdAt DESC, id DESC$/);
    expect(call(sql.query).params).toEqual(['u1']);
  });

  it('finds one by id, or null', async () => {
    expect(await notificationRepo.findById('nope')).toBeNull();
    expect(call(sql.queryOne).params).toEqual(['nope']);
  });

  it('checks whether a notice of one type was already sent for a check-in', async () => {
    sql.queryOne.mockResolvedValueOnce({ found: 1 }).mockResolvedValueOnce(null);

    expect(await notificationRepo.hasForEntry('u1', 'q1', 'almost-up')).toBe(true);
    expect(await notificationRepo.hasForEntry('u1', 'q1', 'almost-up')).toBe(false);
    expect(call(sql.queryOne).params).toEqual(['u1', 'q1', 'almost-up']);
  });

  it('marks one read and returns it', async () => {
    sql.queryOne.mockResolvedValue({ id: 'n1', read: 1 });

    const updated = await notificationRepo.update('n1', { read: true });

    expect(call(sql.query).params).toEqual([{ status: 'viewed' }, 'n1']);
    expect(updated).toEqual({ id: 'n1', read: true });
  });

  it('marks all of a patient’s, or all of one check-in’s, as read', async () => {
    await notificationRepo.markAllRead('u1');
    await notificationRepo.markEntryRead('q1');

    expect(call(sql.query, 0).text).toContain("WHERE userId = ? AND status = 'sent'");
    expect(call(sql.query, 1)).toMatchObject({ params: ['q1'] });
    expect(call(sql.query, 1).text).toContain("WHERE entryId = ? AND status = 'sent'");
  });
});
