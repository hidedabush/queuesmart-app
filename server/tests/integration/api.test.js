import { describe, expect, it } from 'vitest';
import { addToLine, api, clearLine, validService } from '../helpers.js';

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
    const list = await api().get('/services');
    expect(list.status).toBe(200);
    expect(list.body.services).toHaveLength(5);
    expect(list.body.services[0]).toMatchObject({ waiting: 6, hasCalled: false });
    expect((await api().get('/services/s1')).body.service.name).toBe('Sick Visit');
    expect((await api().get('/services/nope')).status).toBe(404);
  });

  it('creates a visit type, and bad fields are a 400', async () => {
    const created = await api().post('/services').send(validService());
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({ name: 'Allergy Shots', isOpen: true, waiting: 0 });

    const bad = await api().post('/services').send({ name: 'X', expectedDuration: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toMatchObject({
      name: 'Use 3-100 characters.',
      description: expect.any(String),
      expectedDuration: 'Must be a whole number.',
      priority: expect.any(String),
    });
  });

  it('a duplicate name is a 409', async () => {
    const res = await api().post('/services').send(validService({ name: 'Lab work' }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('name-taken');
  });

  it('updates, opens/closes and deletes', async () => {
    const updated = await api().patch('/services/s3').send({ expectedDuration: 12 });
    expect(updated.body.service.expectedDuration).toBe(12);
    expect((await api().patch('/services/s3').send({})).status).toBe(400);
    expect((await api().patch('/services/s3').send({ capacity: 2 })).body.error).toBe(
      'capacity-below-waiting'
    );

    const closed = await api().patch('/services/s3/open').send({ isOpen: false });
    expect(closed.body.service.isOpen).toBe(false);
    expect((await api().patch('/services/s3/open').send({ isOpen: 'no' })).status).toBe(400);

    const blocked = await api().delete('/services/s3');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('patients-in-line');

    expect((await api().delete('/services/s5')).status).toBe(204);
    expect((await api().delete('/services/s5')).status).toBe(404);
  });

  it('delete works once the line is empty, and a called patient blocks it', async () => {
    clearLine('s4');
    addToLine('s4', 'called');
    expect((await api().delete('/services/s4')).status).toBe(409);
    clearLine('s4');
    expect((await api().delete('/services/s4')).status).toBe(204);
  });
});

describe('statistics API', () => {
  it('returns per-service numbers and validates the date', async () => {
    const res = await api().get('/stats?date=2026-10-19');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: '2026-10-19' });
    expect(res.body.services).toHaveLength(5);
    expect((await api().get('/stats')).status).toBe(200);
    expect((await api().get('/stats?date=19-10-2026')).status).toBe(400);
  });
});
