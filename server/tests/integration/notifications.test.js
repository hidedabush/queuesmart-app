import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../helpers.js';

// Notifications through the HTTP API, signed in as the seeded demo patient.
let token;
const asPatient = (call) => call.set('authorization', `Bearer ${token}`);

beforeAll(async () => {
  const res = await api()
    .post('/auth/login')
    .send({ email: 'patient@queuesmart.test', password: 'Patient#2026' });
  token = res.body.token;
});

describe('notifications API', () => {
  it('needs a signed-in user', async () => {
    const res = await api().get('/notifications/me');
    expect(res.status).toBe(401);
  });

  it('shows a check-in notification after joining a line', async () => {
    await asPatient(api().post('/services/s3/queue')).send({ reason: 'Fasting blood work' });

    const res = await asPatient(api().get('/notifications/me'));

    expect(res.status).toBe(200);
    expect(res.body.notifications[0]).toMatchObject({
      title: 'Lab Work: checked in',
      status: 'sent',
    });
  });

  it('marks one notification as viewed', async () => {
    await asPatient(api().post('/services/s3/queue')).send({ reason: 'Fasting blood work' });
    const [latest] = (await asPatient(api().get('/notifications/me'))).body.notifications;

    const res = await asPatient(api().patch(`/notifications/${latest.id}/viewed`));

    expect(res.status).toBe(204);
    const after = (await asPatient(api().get('/notifications/me'))).body.notifications;
    expect(after.find((row) => row.id === latest.id).status).toBe('viewed');
  });

  it('marks everything as viewed with /me/viewed', async () => {
    await asPatient(api().post('/services/s3/queue')).send({ reason: 'Fasting blood work' });

    const res = await asPatient(api().patch('/notifications/me/viewed'));

    expect(res.status).toBe(204);
    const after = (await asPatient(api().get('/notifications/me'))).body.notifications;
    expect(after.every((row) => row.status === 'viewed')).toBe(true);
  });

  it('is a 404 for an id that is not the caller’s', async () => {
    const res = await asPatient(api().patch('/notifications/nope/viewed'));
    expect(res.status).toBe(404);
  });
});
