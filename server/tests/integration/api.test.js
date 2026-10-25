import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/database/db.js';
import { addToLine, api, clearLine, validService } from '../helpers.js';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-only-secret-for-queuesmart';
});

// Signs in as a seeded account and returns a client that sends its token.
async function signedIn(email, password) {
  const login = await api().post('/auth/login').send({ email, password });

  expect(login.status).toBe(200);

  const token = login.body.token;
  const auth = (req) =>
    req.set('Authorization', `Bearer ${token}`);

  return {
    get: (path) => auth(api().get(path)),
    post: (path) => auth(api().post(path)),
    patch: (path) => auth(api().patch(path)),
    delete: (path) => auth(api().delete(path)),
  };
}

const adminApi = () => signedIn('admin@queuesmart.test', 'Admin#2026');
const userApi = () => signedIn('patient@queuesmart.test', 'Patient#2026');

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
  it('lists and reads visit types', async () => {
    const admin = await adminApi();
    const list = await admin.get('/services');
    expect(list.status).toBe(200);
    expect(list.body.services).toHaveLength(5);
    expect(list.body.services[0]).toMatchObject({ waiting: 6, hasCalled: false });
    expect((await admin.get('/services/s1')).body.service.name).toBe('Sick Visit');
    expect((await admin.get('/services/nope')).status).toBe(404);
  });

  it('creates a visit type, and bad fields are a 400', async () => {
    const admin = await adminApi();
    const created = await admin.post('/services').send(validService());
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({ name: 'Allergy Shots', isOpen: true, waiting: 0 });

    const bad = await admin.post('/services').send({ name: 'X', expectedDuration: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toMatchObject({
      name: 'Use 3-100 characters.',
      description: expect.any(String),
      expectedDuration: 'Must be a whole number.',
      priority: expect.any(String),
    });
  });

  it('a duplicate name is a 409', async () => {
    const admin = await adminApi();
    const res = await admin.post('/services').send(validService({ name: 'Lab work' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('name-taken');
  });

  it('updates, opens/closes and deletes', async () => {
    const admin = await adminApi();
    const updated = await admin.patch('/services/s3').send({ expectedDuration: 12 });
    expect(updated.body.service.expectedDuration).toBe(12);
    expect((await admin.patch('/services/s3').send({})).status).toBe(400);
    expect((await admin.patch('/services/s3').send({ capacity: 2 })).body.error).toBe(
      'capacity-below-waiting'
    );

    const closed = await admin.patch('/services/s3/open').send({ isOpen: false });
    expect(closed.body.service.isOpen).toBe(false);
    expect((await admin.patch('/services/s3/open').send({ isOpen: 'no' })).status).toBe(400);

    const blocked = await admin.delete('/services/s3');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('patients-in-line');

    expect((await admin.delete('/services/s5')).status).toBe(204);
    expect((await admin.delete('/services/s5')).status).toBe(404);
  });

  it('delete works once the line is empty, and a called patient blocks it', async () => {
    const admin = await adminApi();
    clearLine('s4');
    addToLine('s4', 'called');
    expect((await admin.delete('/services/s4')).status).toBe(409);
    clearLine('s4');
    expect((await admin.delete('/services/s4')).status).toBe(204);
  });
});

describe('statistics API', () => {
  it('returns per-service numbers and validates the date', async () => {
    const admin = await adminApi();
    const res = await admin.get('/stats?date=2026-10-19');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: '2026-10-19' });
    expect(res.body.services).toHaveLength(5);
    expect((await admin.get('/stats')).status).toBe(200);
    expect((await admin.get('/stats?date=19-10-2026')).status).toBe(400);
  });
});

describe('patient queue API on the real app', () => {
  it('check-in, status and cancel reach the database and the live counts', async () => {
    const [admin, patient] = [await adminApi(), await userApi()];
    expect((await patient.get('/queue/me')).body).toEqual({ entry: null });

    const joined = await patient.post('/services/s1/queue').send({ reason: 'New cough' });
    expect(joined.status).toBe(201);
    expect(joined.body.entry).toMatchObject({ serviceId: 's1', position: 7 });
    expect((await patient.get('/services/s1')).body.service.waiting).toBe(7);
    expect((await admin.get('/stats')).body.services[0].currentlyWaiting).toBe(7);

    expect((await patient.get('/queue/me')).body.entry.id).toBe(joined.body.entry.id);
    expect((await patient.delete('/queue/me')).status).toBe(204);
    expect((await patient.get('/services/s1')).body.service.waiting).toBe(6);

    const history = await patient.get('/history/me');
    expect(history.body.history[0]).toMatchObject({ serviceId: 's1', outcome: 'cancelled' });
  });
});

describe('staff queue API', () => {
  it('works a line: view, reorder, triage, call, resolve and remove', async () => {
    const admin = await adminApi();
    const line = await admin.get('/services/s1/queue');
    expect(line.status).toBe(200);
    expect(line.body.called).toBeNull();
    expect(line.body.waiting.map((entry) => entry.id)).toEqual([
      'q-seed-1', 'q-seed-2', 'q-seed-3', 'q-seed-4', 'q-seed-5', 'q-seed-6',
    ]);
    expect(line.body.waiting[0]).toMatchObject({ patientName: 'Demo Patient 1', dob: '1990-01-01' });

    const moved = await admin.patch('/queue/q-seed-1').send({ direction: 1 });
    expect(moved.status).toBe(200);
    expect(moved.body.waiting[1].id).toBe('q-seed-1');

    const triaged = await admin.patch('/queue/q-seed-6').send({ priority: 'urgent' });
    expect(triaged.body.waiting[0]).toMatchObject({ id: 'q-seed-6', priority: 'urgent' });

    const called = await admin.post('/services/s1/queue/call');
    expect(called.status).toBe(200);
    expect(called.body.called).toMatchObject({ id: 'q-seed-6', status: 'called' });
    expect((await admin.post('/services/s1/queue/call')).body.error).toBe('already-calling');
    expect((await admin.get('/services/s1')).body.service).toMatchObject({ hasCalled: true, waiting: 5 });

    const resolved = await admin.post('/services/s1/queue/called').send({ outcome: 'seen' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolved.id).toBe('q-seed-6');
    expect((await admin.post('/services/s1/queue/called').send({ outcome: 'seen' })).body.error).toBe(
      'nothing-called'
    );

    expect((await admin.delete('/queue/q-seed-2')).status).toBe(204);
    expect((await admin.delete('/queue/q-seed-2')).status).toBe(404);

    const stats = (await admin.get('/stats')).body.services[0];
    expect(stats).toMatchObject({ served: 1, removed: 1, currentlyWaiting: 4 });
  });

  it('a patient sees their own check-in move to called', async () => {
    const [admin, patient] = [await adminApi(), await userApi()];
    db.update('services', 's5', { isOpen: true });
    await patient.post('/services/s5/queue').send({ reason: 'Refill check' });
    await admin.post('/services/s5/queue/call');

    expect((await patient.get('/queue/me')).body.entry).toMatchObject({
      serviceId: 's5',
      status: 'called',
      position: 0,
    });
  });

  it('rejects bad bodies, an empty line and unknown ids', async () => {
    const admin = await adminApi();
    const patch = (body) => admin.patch('/queue/q-seed-1').send(body);

    expect((await patch({})).status).toBe(400);
    expect((await patch({ direction: 1, priority: 'urgent' })).body.fields).toHaveProperty('body');
    expect((await patch({ direction: 2 })).body.fields.direction).toBe('Direction must be -1 or 1.');
    expect((await patch({ priority: 'asap' })).body.fields.priority).toBe('Choose normal or urgent.');
    expect((await admin.patch('/queue/nope').send({ direction: 1 })).status).toBe(404);

    const outcome = await admin.post('/services/s1/queue/called').send({ outcome: 'done' });
    expect(outcome.status).toBe(400);
    expect(outcome.body.fields.outcome).toBe('Choose seen or no-show.');

    expect((await admin.post('/services/s5/queue/call')).body.error).toBe('empty');
    expect((await admin.get('/services/nope/queue')).status).toBe(404);
  });

  it('is staff only: no token is a 401 and a patient token is a 403', async () => {
    expect((await api().get('/services/s1/queue')).status).toBe(401);
    expect((await api().delete('/queue/q-seed-1')).status).toBe(401);

    const patient = await userApi();
    expect((await patient.post('/services/s1/queue/call')).status).toBe(403);
    expect((await patient.patch('/queue/q-seed-1').send({ direction: 1 })).status).toBe(403);
  });
});
