import { describe, expect, it } from 'vitest';
import * as notifications from '../../src/api/notifications/notificationService.js';
import * as db from '../fakes/db.js';

// Notification component (docs/A3-api-spec.txt section 6).
const sickVisit = { id: 's1', name: 'Sick Visit' };
const entry = (number) => db.find('queueEntries', `q-seed-${number}`);
const line = (numbers) => numbers.map(entry);
const sentTo = (userId) => db.all('notifications').filter((row) => row.userId === userId);

describe('notifyJoined', () => {
  it('tells the patient their place and wait, without the visit reason', async () => {
    const sent = await notifications.notifyJoined(entry(1), sickVisit, 1, { low: 10, high: 15 });

    expect(sent).toEqual({
      id: expect.any(String),
      type: 'joined',
      title: 'Sick Visit: you’re checked in',
      message: 'You’re #1 in line, about 10-15 min.',
      serviceId: 's1',
      entryId: 'q-seed-1',
      read: false,
      createdAt: expect.any(Number),
      channels: ['in-app'],
    });
    expect(JSON.stringify(sent)).not.toContain(entry(1).reason);
  });

  it('says so when no wait is expected', async () => {
    const sent = await notifications.notifyJoined(entry(1), sickVisit, 1, null);
    expect(sent.message).toBe('You’re #1 in line, no wait expected.');
  });

  it('adds the sms channel for a patient with a phone number', async () => {
    const withPhone = { ...entry(1), id: 'q-test', userId: 'u-patient' };
    const sent = await notifications.notifyJoined(withPhone, sickVisit, 1, null);
    expect(sent.channels).toEqual(['in-app', 'sms']);
  });

  it('skips a patient with no account', async () => {
    const sent = await notifications.notifyJoined({ id: 'q-x', userId: 'u-gone' }, sickVisit, 1, null);
    expect(sent).toBeNull();
    expect(db.all('notifications')).toHaveLength(0);
  });
});

describe('notifyLineChanged', () => {
  it('tells the first patients to head to the office, once each', async () => {
    await notifications.notifyLineChanged(sickVisit, line([1, 2, 3, 4, 5, 6]));
    await notifications.notifyLineChanged(sickVisit, line([1, 2, 3, 4, 5, 6]));

    for (const number of [1, 2, 3]) {
      expect(sentTo(`u-seed-${number}`)).toEqual([
        expect.objectContaining({ type: 'almost-up', title: 'Sick Visit: head to the office' }),
      ]);
    }
    expect(sentTo('u-seed-4')).toEqual([]);
  });

  it('reaches the next patient when the line moves up', async () => {
    await notifications.notifyLineChanged(sickVisit, line([1, 2, 3, 4]));
    await notifications.notifyLineChanged(sickVisit, line([2, 3, 4]));

    expect(sentTo('u-seed-4')).toHaveLength(1);
    expect(sentTo('u-seed-2')).toHaveLength(1);
  });
});

describe('notifyCalled and closeForEntry', () => {
  it('tells the called patient it is their turn', async () => {
    const sent = await notifications.notifyCalled(entry(1), sickVisit);
    expect(sent).toMatchObject({
      type: 'called',
      title: 'Sick Visit: it’s your turn',
      message: 'Please come to the front desk now.',
    });
  });

  it('marks every notice for a finished check-in as read', async () => {
    await notifications.notifyJoined(entry(1), sickVisit, 1, null);
    await notifications.notifyCalled(entry(1), sickVisit);
    await notifications.notifyCalled(entry(2), sickVisit);

    await notifications.closeForEntry('q-seed-1');

    expect(sentTo('u-seed-1').every((row) => row.read)).toBe(true);
    expect(sentTo('u-seed-2')[0].read).toBe(false);
  });
});

describe('the patient’s list', () => {
  const asPatient = { ...entry(1), id: 'q-test', userId: 'u-patient' };

  it('lists only the caller’s, newest first, with the unread count', async () => {
    await notifications.notifyJoined(asPatient, sickVisit, 1, null);
    await notifications.notifyCalled(asPatient, sickVisit);
    await notifications.notifyCalled(entry(1), sickVisit);

    const result = await notifications.listMine('u-patient');

    expect(result.unread).toBe(2);
    expect(result.notifications.map((row) => row.type)).toEqual(['called', 'joined']);
  });

  it('marks one as read', async () => {
    const sent = await notifications.notifyCalled(asPatient, sickVisit);

    const { notification } = await notifications.markRead('u-patient', sent.id);

    expect(notification).toMatchObject({ id: sent.id, read: true });
    expect((await notifications.listMine('u-patient')).unread).toBe(0);
  });

  it('hides someone else’s notification behind a 404', async () => {
    const theirs = await notifications.notifyCalled(entry(1), sickVisit);

    await expect(notifications.markRead('u-patient', theirs.id)).rejects.toMatchObject({ status: 404 });
    await expect(notifications.markRead('u-patient', 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('marks all of the caller’s as read', async () => {
    await notifications.notifyJoined(asPatient, sickVisit, 1, null);
    await notifications.notifyCalled(entry(1), sickVisit);

    expect(await notifications.markAllRead('u-patient')).toEqual({ unread: 0 });
    expect((await notifications.listMine('u-patient')).unread).toBe(0);
    expect(sentTo('u-seed-1')[0].read).toBe(false);
  });

  it('is empty for a patient with no notifications', async () => {
    expect(await notifications.listMine('u-new')).toEqual({ notifications: [], unread: 0 });
  });
});
