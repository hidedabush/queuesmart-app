import express from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import * as db from '../../src/database/db.js';
import { errorHandler, notFoundHandler } from '../../src/api/middleware/errors.js';
import { patientQueueRoutes } from '../../src/api/routes/patientQueueRoutes.js';
import { patientServiceQueueRoutes } from '../../src/api/routes/patientServiceQueueRoutes.js';

// Test-only authentication stand-in. This verifies the controller's
// req.user.id dependency; it does not replace real application auth.
function createPatientQueueTestApp() {
  const app = express();

  app.use(express.json());

  app.use((req, res, next) => {
    req.user = { id: 'u-patient-test' };
    next();
  });

  app.use('/services', patientServiceQueueRoutes);
  app.use('/queue', patientQueueRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createPatientQueueTestApp();

beforeEach(() => {
  db.reset();
});

describe('patient queue API', () => {
  it('POST joins an open service and returns 201 with an entry', async () => {
    const res = await request(app)
      .post('/services/s1/queue')
      .send({ reason: '  New cough  ' });

    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({
      serviceId: 's1',
      serviceName: 'Sick Visit',
      reason: 'New cough',
      priority: 'normal',
      status: 'waiting',
      position: 7,
      peopleAhead: 6,
      estimatedWait: { low: 90, high: 117 },
    });
  });

  it('POST rejects an invalid reason with a 400 validation response', async () => {
    const res = await request(app)
      .post('/services/s1/queue')
      .send({ reason: 'X' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'validation',
      fields: {
        reason: expect.any(String),
      },
    });
  });

  it('POST returns the expected conflict code for a duplicate check-in', async () => {
    await request(app)
      .post('/services/s1/queue')
      .send({ reason: 'First visit' });

    const res = await request(app)
      .post('/services/s3/queue')
      .send({ reason: 'Second visit' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already-checked-in');
  });

  it('POST rejects a closed service', async () => {
    const res = await request(app)
      .post('/services/s5/queue')
      .send({ reason: 'Prescription question' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('closed');
  });

  it('GET returns the current patient entry, then null after cancellation', async () => {
    await request(app)
      .post('/services/s1/queue')
      .send({ reason: 'New cough' });

    const active = await request(app).get('/queue/me');

    expect(active.status).toBe(200);
    expect(active.body.entry).toMatchObject({
      serviceId: 's1',
      serviceName: 'Sick Visit',
      reason: 'New cough',
      status: 'waiting',
    });

    const cancelled = await request(app).delete('/queue/me');

    expect(cancelled.status).toBe(204);
    expect(cancelled.text).toBe('');

    const empty = await request(app).get('/queue/me');

    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ entry: null });
  });

  it('DELETE returns a not-found error when no active entry exists', async () => {
    const res = await request(app).delete('/queue/me');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not-found');
  });

  it('POST rejects a full service with a 409 conflict', async () => {
    db.update('services', 's4', { capacity: 3 });

    const res = await request(app)
      .post('/services/s4/queue')
      .send({ reason: 'Vaccination' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('full');
  });

  it('POST returns a 404 for an unknown service', async () => {
    const res = await request(app)
      .post('/services/unknown-service/queue')
      .send({ reason: 'New visit' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not-found');
  });
});
