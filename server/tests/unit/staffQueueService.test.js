import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../fakes/db.js';
import * as staffQueue from '../../src/api/services/staffQueueService.js';
import { statsForDate, today } from '../../src/api/services/statsService.js';

beforeEach(() => {
  db.reset();
});

describe('staff queue service', () => {
  const ids = (line) => line.waiting.map((entry) => entry.id);
  // Notification titles one patient was sent, newest first.
  const titlesFor = (userId) =>
    db
      .all('notifications')
      .filter((row) => row.userId === userId)
      .reverse()
      .map((row) => row.title);
  const unreadFor = (userId) =>
    db.all('notifications').filter((row) => row.userId === userId && !row.read).length;
  const todaysStats = async (serviceId) =>
    (await statsForDate(today())).services.find((row) => row.serviceId === serviceId);

  describe('getLine', () => {
    it('returns the ordered waiting line with positions and nobody called', async () => {
      const line = await staffQueue.getLine('s1');

      expect(line.called).toBeNull();
      expect(line.waiting).toHaveLength(6);
      expect(line.waiting[0]).toMatchObject({
        id: 'q-seed-1',
        position: 1,
        status: 'waiting',
        patientName: 'Demo Patient 1',
        displayName: 'Demo 1.',
        dob: '1990-01-01',
      });
      expect(line.waiting.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('shows a one-word name as is', async () => {
      db.update('users', 'u-seed-1', { name: 'Cher' });

      expect((await staffQueue.getLine('s1')).waiting[0]).toMatchObject({
        patientName: 'Cher',
        displayName: 'Cher',
      });
    });

    it('still lists a patient whose account was deleted, without a name', async () => {
      db.remove('users', 'u-seed-1');

      expect((await staffQueue.getLine('s1')).waiting[0]).toMatchObject({
        id: 'q-seed-1',
        patientName: null,
        dob: null,
        displayName: null,
      });
    });

    it('returns not-found for an unknown service', async () => {
      await expect(staffQueue.getLine('nope')).rejects.toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  describe('callNext', () => {
    it('tells the called patient it is their turn, and the next ones to head in', async () => {
      await staffQueue.callNext('s1');

      expect(titlesFor('u-seed-1')).toEqual(['Sick Visit: it’s your turn']);
      // With patient 1 called, patients 2-4 have 2 or fewer ahead of them.
      expect(titlesFor('u-seed-4')).toEqual(['Sick Visit: head to the office']);
      expect(titlesFor('u-seed-5')).toEqual([]);
    });

    it('calls the first patient and takes them out of the waiting line', async () => {
      const { called } = await staffQueue.callNext('s1');

      expect(called).toMatchObject({ id: 'q-seed-1', status: 'called', position: 0 });
      expect(called.calledAt).toEqual(expect.any(Number));

      const line = await staffQueue.getLine('s1');
      expect(line.called.id).toBe('q-seed-1');
      expect(line.waiting).toHaveLength(5);
    });

    it('calls an urgent patient before earlier arrivals', async () => {
      await staffQueue.moveEntry('q-seed-4', { priority: 'urgent' });

      expect((await staffQueue.callNext('s1')).called.id).toBe('q-seed-4');
    });

    it('allows only one called patient per line', async () => {
      await staffQueue.callNext('s1');

      await expect(staffQueue.callNext('s1')).rejects.toThrow(
        expect.objectContaining({ status: 409, code: 'already-calling' })
      );
    });

    it('rejects an empty line', async () => {
      await expect(staffQueue.callNext('s5')).rejects.toThrow(
        expect.objectContaining({ status: 409, code: 'empty' })
      );
    });
  });

  describe('resolveCalled', () => {
    it('records a seen visit in history and frees the line', async () => {
      await staffQueue.callNext('s1');
      const { resolved } = await staffQueue.resolveCalled('s1', 'seen');

      expect(resolved.id).toBe('q-seed-1');
      expect(db.find('queueEntries', 'q-seed-1')).toMatchObject({ status: 'served', leftAt: expect.any(Number) });
      expect((await staffQueue.getLine('s1')).called).toBeNull();
      expect(await todaysStats('s1')).toMatchObject({
        served: 1,
        currentlyWaiting: 5,
        averageWaitMinutes: expect.any(Number),
      });
    });

    it('records a no-show', async () => {
      await staffQueue.callNext('s2');
      await staffQueue.resolveCalled('s2', 'no-show');

      expect(await todaysStats('s2')).toMatchObject({ served: 0, noShows: 1 });
      expect(db.find('queueEntries', 'q-seed-7').status).toBe('no-show');
    });

    it('closes the patient’s notices once their visit is resolved', async () => {
      await staffQueue.callNext('s2');
      expect(unreadFor('u-seed-7')).toBe(1);

      await staffQueue.resolveCalled('s2', 'seen');

      expect(titlesFor('u-seed-7')).toEqual(['Minor Injury: it’s your turn']);
      expect(unreadFor('u-seed-7')).toBe(0);
    });

    it('rejects a resolve when nobody is called', async () => {
      await expect(staffQueue.resolveCalled('s1', 'seen')).rejects.toThrow(
        expect.objectContaining({ status: 409, code: 'nothing-called' })
      );
    });
  });

  describe('moveEntry', () => {
    it('moves a patient down by swapping with the next patient', async () => {
      const line = await staffQueue.moveEntry('q-seed-1', { direction: 1 });

      expect(ids(line).slice(0, 3)).toEqual(['q-seed-2', 'q-seed-1', 'q-seed-3']);
    });

    it('changes nothing at the top of the line', async () => {
      const line = await staffQueue.moveEntry('q-seed-1', { direction: -1 });

      expect(ids(line)[0]).toBe('q-seed-1');
    });

    it('changes nothing for a patient who is already called', async () => {
      await staffQueue.callNext('s1');
      const line = await staffQueue.moveEntry('q-seed-1', { direction: 1 });

      expect(ids(line)).toEqual(['q-seed-2', 'q-seed-3', 'q-seed-4', 'q-seed-5', 'q-seed-6']);
      expect(db.find('queueEntries', 'q-seed-1').status).toBe('called');
    });

    it('never moves a normal patient past an urgent one', async () => {
      await staffQueue.moveEntry('q-seed-2', { priority: 'urgent' });
      const line = await staffQueue.moveEntry('q-seed-1', { direction: -1 });

      expect(ids(line).slice(0, 2)).toEqual(['q-seed-2', 'q-seed-1']);
    });

    it('marking a patient urgent moves them to the front', async () => {
      const line = await staffQueue.moveEntry('q-seed-5', { priority: 'urgent' });

      expect(line.waiting[0]).toMatchObject({ id: 'q-seed-5', priority: 'urgent', position: 1 });
    });

    it('returns not-found for an unknown entry', async () => {
      await expect(staffQueue.moveEntry('nope', { direction: 1 })).rejects.toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  describe('removeEntry', () => {
    it('takes a patient out of line and records it in history', async () => {
      await staffQueue.removeEntry('q-seed-3');

      expect(ids(await staffQueue.getLine('s1'))).not.toContain('q-seed-3');
      expect(await todaysStats('s1')).toMatchObject({ removed: 1, currentlyWaiting: 5 });
      expect(db.find('queueEntries', 'q-seed-3').status).toBe('removed');
      // The line moved up, so patient 4 is now third.
      expect(titlesFor('u-seed-4')).toEqual(['Sick Visit: head to the office']);
    });

    it('treats a finished entry as no longer in line', async () => {
      await staffQueue.removeEntry('q-seed-3');

      await expect(staffQueue.removeEntry('q-seed-3')).rejects.toThrow(
        expect.objectContaining({ status: 404 })
      );
      await expect(staffQueue.moveEntry('q-seed-3', { direction: 1 })).rejects.toThrow(
        expect.objectContaining({ status: 404 })
      );
    });

    it('returns not-found for an unknown entry', async () => {
      await expect(staffQueue.removeEntry('nope')).rejects.toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });
});
