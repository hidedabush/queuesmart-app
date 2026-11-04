import { describe, expect, it } from 'vitest';
import * as notifications from '../../src/api/services/notificationService.js';
import * as db from '../fakes/db.js';

describe('notifications', () => {
  it('lists only the caller’s notifications, newest first', async () => {
    await notifications.notify('u-patient', 'Lab Work: checked in', 'You are number 5 in line.');
    await notifications.notify('u-someone-else', 'Not yours', 'Hidden.');

    const { notifications: mine } = await notifications.listMine('u-patient');

    expect(mine[0]).toEqual({
      id: expect.any(String),
      title: 'Lab Work: checked in',
      message: 'You are number 5 in line.',
      createdAt: expect.any(Number),
      status: 'sent',
    });
    // The two seeded, already viewed ones follow.
    expect(mine.map((row) => row.status)).toEqual(['sent', 'viewed', 'viewed']);
    expect(mine.some((row) => row.title === 'Not yours')).toBe(false);
  });

  it('marks one notification as viewed', async () => {
    const sent = await notifications.notify('u-patient', 'Sick Visit: it is your turn', 'Come in.');

    await notifications.markViewed('u-patient', sent.id);

    expect(db.find('notifications', sent.id).status).toBe('viewed');
  });

  it('will not mark another patient’s notification', async () => {
    const theirs = await notifications.notify('u-someone-else', 'Theirs', 'Hidden.');

    await expect(notifications.markViewed('u-patient', theirs.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(notifications.markViewed('u-patient', 'nope')).rejects.toMatchObject({
      status: 404,
    });
    expect(db.find('notifications', theirs.id).status).toBe('sent');
  });

  it('marks all of the caller’s notifications as viewed', async () => {
    await notifications.notify('u-patient', 'One', 'First.');
    await notifications.notify('u-patient', 'Two', 'Second.');
    const theirs = await notifications.notify('u-someone-else', 'Theirs', 'Hidden.');

    await notifications.markAllViewed('u-patient');

    const { notifications: mine } = await notifications.listMine('u-patient');
    expect(mine.every((row) => row.status === 'viewed')).toBe(true);
    expect(db.find('notifications', theirs.id).status).toBe('sent');
  });

  it('is empty for a patient with no notifications', async () => {
    expect(await notifications.listMine('u-new')).toEqual({ notifications: [] });
  });
});
