import { describe, expect, it } from 'vitest';
import { ADMIN, PATIENT, adminToken, anon, as, patientToken, validService } from '../helpers.js';

const admin = () => as(adminToken());
const patient = () => as(patientToken());

describe('health and errors', () => {
  it('GET /health works without signing in', async () => {
    const res = await anon().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('an unknown route is a 404 in the standard shape', async () => {
    const res = await anon().get('/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not-found');
  });

  it('a malformed JSON body is a 400 validation error', async () => {
    const res = await anon()
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: 'validation', fields: { body: expect.any(String) } });
  });
});

describe('authentication API', () => {
  it('register -> login -> /auth/me', async () => {
    const register = await anon().post('/auth/register').send({
      name: 'Ana Torres',
      dob: '03/14/1995',
      email: 'ana@example.com',
      password: 'Queue#2026',
      phone: '(713) 555-0199',
    });
    expect(register.status).toBe(201);
    expect(register.body.user).toMatchObject({ role: 'user', dob: '1995-03-14', phone: '7135550199' });

    const login = await anon()
      .post('/auth/login')
      .send({ email: 'ANA@example.com', password: 'Queue#2026' });
    expect(login.status).toBe(200);

    const me = await as(login.body.token).get('/auth/me');
    expect(me.body.user.email).toBe('ana@example.com');
  });

  it('register with an empty body lists every required field', async () => {
    const res = await anon().post('/auth/register').send({});
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.fields).sort()).toEqual(['dob', 'email', 'name', 'password']);
  });

  it('register with a taken email is a 409', async () => {
    const res = await anon().post('/auth/register').send({
      name: 'Alex Rivera',
      dob: '05/20/1994',
      email: PATIENT.email,
      password: 'Queue#2026',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email-taken');
  });

  it('a wrong password is a 401', async () => {
    const res = await anon().post('/auth/login').send({ email: ADMIN.email, password: 'Wrong#2026' });
    expect(res.status).toBe(401);
  });

  it('the demo admin can sign in and gets the admin role', async () => {
    const res = await anon().post('/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    expect(res.body.user.role).toBe('admin');
  });

  it('protected routes need a valid token', async () => {
    expect((await anon().get('/services')).status).toBe(401);
    expect((await as('forged.token').get('/services')).status).toBe(401);
    const gone = await as(
      // A genuine token for a user that no longer exists.
      (await import('../../src/api/services/authService.js')).signToken({ userId: 'ghost', role: 'user' })
    ).get('/services');
    expect(gone.status).toBe(401);
  });

  it('changes the password', async () => {
    const res = await patient().patch('/auth/me/password').send({ password: 'Brand#New2026' });
    expect(res.status).toBe(204);
    const bad = await patient().patch('/auth/me/password').send({ password: 'weak' });
    expect(bad.status).toBe(400);
  });
});

describe('service management API', () => {
  it('any signed-in user can list and read visit types', async () => {
    const list = await patient().get('/services');
    expect(list.status).toBe(200);
    expect(list.body.services).toHaveLength(5);
    expect((await patient().get('/services/s1')).body.service.name).toBe('Sick Visit');
    expect((await patient().get('/services/nope')).status).toBe(404);
  });

  it('only admins can create, and bad fields are a 400', async () => {
    expect((await patient().post('/services').send(validService())).status).toBe(403);

    const created = await admin().post('/services').send(validService());
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({ name: 'Allergy Shots', isOpen: true });

    const bad = await admin().post('/services').send({ name: 'X', expectedDuration: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toMatchObject({
      name: expect.any(String),
      description: expect.any(String),
      expectedDuration: 'Must be a whole number.',
      priority: expect.any(String),
    });
  });

  it('updates, opens/closes and deletes', async () => {
    const updated = await admin().patch('/services/s3').send({ expectedDuration: 12 });
    expect(updated.body.service.expectedDuration).toBe(12);

    const closed = await admin().patch('/services/s3/open').send({ isOpen: false });
    expect(closed.body.service.isOpen).toBe(false);
    expect((await admin().patch('/services/s3/open').send({ isOpen: 'no' })).status).toBe(400);

    const blocked = await admin().delete('/services/s3');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('patients-in-line');

    expect((await admin().delete('/services/s5')).status).toBe(204);
  });
});

describe('queue API', () => {
  it('runs the full demo loop: join, get called, be seen, see history', async () => {
    const join = await patient().post('/services/s2/queue').send({ reason: 'Cut on my hand' });
    expect(join.status).toBe(201);
    expect(join.body.entry).toMatchObject({ position: 3, status: 'head-in' });

    for (let i = 0; i < 2; i += 1) {
      expect((await admin().post('/services/s2/queue/call')).status).toBe(200);
      expect(
        (await admin().post('/services/s2/queue/called').send({ outcome: 'seen' })).status
      ).toBe(200);
    }
    await admin().post('/services/s2/queue/call');
    expect((await patient().get('/queue/me')).body.entry.status).toBe('called');

    const resolved = await admin().post('/services/s2/queue/called').send({ outcome: 'seen' });
    expect(resolved.body.resolved.patientName).toBe('Alex Rivera');
    expect((await patient().get('/queue/me')).body.entry).toBeNull();

    const history = await patient().get('/history/me');
    expect(history.body.history[0]).toMatchObject({ serviceName: 'Minor Injury', outcome: 'seen' });
  });

  it('rejects a bad reason, a closed line and a second check-in', async () => {
    const short = await patient().post('/services/s1/queue').send({ reason: 'ab' });
    expect(short.status).toBe(400);
    expect(short.body.fields.reason).toBe('Use at least 3 characters.');

    expect((await patient().post('/services/s5/queue').send({ reason: 'Refill' })).body.error).toBe(
      'closed'
    );

    await patient().post('/services/s1/queue').send({ reason: 'Sore throat' });
    const again = await patient().post('/services/s3/queue').send({ reason: 'Blood work' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('already-checked-in');
  });

  it('a patient can leave the line', async () => {
    await patient().post('/services/s1/queue').send({ reason: 'Sore throat' });
    expect((await patient().delete('/queue/me')).status).toBe(204);
    expect((await patient().delete('/queue/me')).status).toBe(404);
  });

  it('staff routes are admin-only', async () => {
    expect((await patient().get('/services/s1/queue')).status).toBe(403);
    expect((await patient().post('/services/s1/queue/call')).status).toBe(403);
  });

  it('staff can view, triage, move and remove', async () => {
    const line = await admin().get('/services/s1/queue');
    expect(line.body.called).toBeNull();
    expect(line.body.waiting).toHaveLength(6);

    const last = line.body.waiting.at(-1);
    const triaged = await admin().patch(`/queue/${last.id}`).send({ priority: 'urgent' });
    expect(triaged.body.waiting[0].id).toBe(last.id);

    const both = await admin().patch(`/queue/${last.id}`).send({ priority: 'normal', direction: 1 });
    expect(both.status).toBe(400);

    expect((await admin().delete(`/queue/${last.id}`)).status).toBe(204);
    expect((await admin().delete(`/queue/${last.id}`)).status).toBe(404);
  });

  it('serving rules come back as 409s', async () => {
    expect((await admin().post('/services/s1/queue/called').send({ outcome: 'seen' })).body.error).toBe(
      'nothing-called'
    );
    await admin().post('/services/s1/queue/call');
    expect((await admin().post('/services/s1/queue/call')).body.error).toBe('already-calling');
    expect((await admin().post('/services/s1/queue/called').send({ outcome: 'gone' })).status).toBe(400);
  });
});

describe('notifications API', () => {
  it('lists, reads and clears the patient\'s notifications', async () => {
    await patient().post('/services/s2/queue').send({ reason: 'Cut on my hand' });

    const list = await patient().get('/notifications/me');
    expect(list.body.unread).toBe(2);
    expect(list.body.notifications.map((n) => n.type).sort()).toEqual(['almost-up', 'joined']);

    const [first] = list.body.notifications;
    const read = await patient().patch(`/notifications/${first.id}/read`);
    expect(read.body.notification.read).toBe(true);
    expect((await admin().patch(`/notifications/${first.id}/read`)).status).toBe(404);

    expect((await patient().post('/notifications/me/read-all')).body.unread).toBe(0);
    expect((await patient().get('/notifications/me')).body.unread).toBe(0);
  });
});

describe('statistics API', () => {
  it('is admin-only and validates the date', async () => {
    const res = await admin().get('/stats?date=2026-10-19');
    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(5);
    expect((await admin().get('/stats')).status).toBe(200);
    expect((await admin().get('/stats?date=19-10-2026')).status).toBe(400);
    expect((await patient().get('/stats')).status).toBe(403);
  });
});
