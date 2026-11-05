import { describe, expect, it } from 'vitest';
import * as db from '../fakes/db.js';
import { addToLine, api, clearLine, signedIn, validService } from '../helpers.js';

const admin = () => signedIn('admin');
const patient = () => signedIn('user');

describe('health and errors', () => {
  it('GET /health works', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('an unknown route is a 404 in the standard shape', async () => {
    const res = await api().get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not-found');
  });

  it('a malformed JSON body is a 400 validation error', async () => {
    const res = await api()
      .post('/services')
      .set('Content-Type', 'application/json')
      .send('{"name": ');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'validation', fields: { body: expect.any(String) } });
  });
});

describe('service management API', () => {
  it('lists and reads visit types with their live line', async () => {
    const list = await admin().get('/services');
    expect(list.status).toBe(200);
    expect(list.body.services).toHaveLength(5);
    expect(list.body.services[0]).toMatchObject({
      waiting: 6,
      hasCalled: false,
      estimatedWait: { low: 90, high: 117 },
    });
    expect((await admin().get('/services/s1')).body.service.name).toBe('Sick Visit');
    expect((await admin().get('/services/nope')).status).toBe(404);
  });

  it('creates a visit type, and bad fields are a 400', async () => {
    const created = await admin().post('/services').send(validService());
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({ name: 'Allergy Shots', isOpen: true, waiting: 0 });

    const bad = await admin().post('/services').send({ name: 'X', expectedDuration: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toMatchObject({
      name: 'Use 3-100 characters.',
      description: expect.any(String),
      expectedDuration: 'Must be a whole number.',
      priority: expect.any(String),
    });
  });

  it('a duplicate name is a 409', async () => {
    const res = await admin().post('/services').send(validService({ name: 'Lab work' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('name-taken');
  });

  it('updates, opens/closes and deletes', async () => {
    const updated = await admin().patch('/services/s3').send({ expectedDuration: 12 });
    expect(updated.body.service.expectedDuration).toBe(12);
    expect((await admin().patch('/services/s3').send({})).status).toBe(400);
    expect((await admin().patch('/services/s3').send({ capacity: 2 })).body.error).toBe('capacity-below-waiting');

    const closed = await admin().patch('/services/s3/open').send({ isOpen: false });
    expect(closed.body.service).toMatchObject({ isOpen: false, estimatedWait: null });
    expect((await admin().patch('/services/s3/open').send({ isOpen: 'no' })).status).toBe(400);

    const blocked = await admin().delete('/services/s3');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('patients-in-line');

    expect((await admin().delete('/services/s5')).status).toBe(204);
    expect((await admin().delete('/services/s5')).status).toBe(404);
  });

  it('delete works once the line is empty, and a called patient blocks it', async () => {
    clearLine('s4');
    addToLine('s4', 'called');
    expect((await admin().delete('/services/s4')).status).toBe(409);
    clearLine('s4');
    expect((await admin().delete('/services/s4')).status).toBe(204);
  });

  it('anyone signed in can read; only staff can change', async () => {
    expect((await api().get('/services')).status).toBe(401);
    expect((await patient().get('/services')).status).toBe(200);
    expect((await patient().post('/services').send(validService())).status).toBe(403);
    expect((await patient().patch('/services/s1/open').send({ isOpen: false })).status).toBe(403);
    expect((await patient().delete('/services/s5')).status).toBe(403);
  });
});

describe('statistics API', () => {
  it('returns per-service numbers and validates the date', async () => {
    const res = await admin().get('/stats?date=2026-09-28');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: '2026-09-28' });
    expect(res.body.services).toHaveLength(5);
    expect(res.body.services.find((s) => s.serviceId === 's4')).toMatchObject({ served: 1, averageWaitMinutes: 25 });
    expect((await admin().get('/stats')).status).toBe(200);
    expect((await admin().get('/stats?date=19-10-2026')).status).toBe(400);
  });

  it('is staff only', async () => {
    expect((await api().get('/stats')).status).toBe(401);
    expect((await patient().get('/stats')).status).toBe(403);
  });

  it('shows a visit that just ended in today’s numbers', async () => {
    const before = (await admin().get('/stats')).body.services[0];
    const [first] = db.all('queueEntries').filter((entry) => entry.serviceId === 's1');
    db.update('queueEntries', first.id, { status: 'called', calledAt: first.arrivedAt });

    // Ends now, so it counts for today (the trigger's history row in MySQL).
    const { finish } = await import('../fakes/repositories/queueRepo.js');
    await finish(first.id, 'served');

    const after = (await admin().get('/stats')).body.services[0];
    expect(after.currentlyWaiting).toBe(before.currentlyWaiting - 1);
    expect(after.served).toBe(before.served + 1);
  });
});
