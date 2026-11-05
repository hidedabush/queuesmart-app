import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../helpers.js';

// Notifications through the HTTP API (docs/A3-api-spec.txt section 6),
// signed in as the seeded demo patient.
let token;
const asPatient = (call) => call.set('authorization', `Bearer ${token}`);
const checkIn = () => asPatient(api().post('/services/s3/queue')).send({ reason: 'Fasting blood work' });
const listMine = async () => (await asPatient(api().get('/notifications/me'))).body;

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

  it('shows a joined notification after checking in', async () => {
    await checkIn();

    const res = await asPatient(api().get('/notifications/me'));

    expect(res.status).toBe(200);
    expect(res.body.unread).toBe(1);
    expect(res.body.notifications[0]).toMatchObject({
      type: 'joined',
      title: 'Lab Work: you’re checked in',
      serviceId: 's3',
      read: false,
      channels: ['in-app', 'sms'],
    });
  });

  it('marks one notification as read', async () => {
    await checkIn();
    const [latest] = (await listMine()).notifications;

    const res = await asPatient(api().patch(`/notifications/${latest.id}/read`));

    expect(res.status).toBe(200);
    expect(res.body.notification).toMatchObject({ id: latest.id, read: true });
    expect((await listMine()).unread).toBe(0);
  });

  it('marks everything as read', async () => {
    await checkIn();

    const res = await asPatient(api().post('/notifications/me/read-all'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unread: 0 });
    expect((await listMine()).notifications.every((row) => row.read)).toBe(true);
  });

  it('closes the notices once the patient cancels', async () => {
    await checkIn();
    await asPatient(api().delete('/queue/me'));

    expect((await listMine()).unread).toBe(0);
  });

  it('is a 404 for an id that is not the caller’s', async () => {
    const res = await asPatient(api().patch('/notifications/nope/read'));
    expect(res.status).toBe(404);
  });
});
