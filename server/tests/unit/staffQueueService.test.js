import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/database/db.js';
import * as staffQueue from '../../src/api/services/staffQueueService.js';
import { statsForDate, today } from '../../src/api/services/statsService.js';

beforeEach(() => {
  db.reset();
});

describe('staff queue service', () => {
  const ids = (line) => line.waiting.map((entry) => entry.id);
  const todaysStats = (serviceId) =>
    statsForDate(today()).services.find((row) => row.serviceId === serviceId);

  describe('getLine', () => {
    it('returns the ordered waiting line with positions and nobody called', () => {
      const line = staffQueue.getLine('s1');

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

    it('shows a one-word name as is', () => {
      db.update('users', 'u-seed-1', { name: 'Cher' });

      expect(staffQueue.getLine('s1').waiting[0]).toMatchObject({
        patientName: 'Cher',
        displayName: 'Cher',
      });
    });

    it('still lists a patient whose account was deleted, without a name', () => {
      db.remove('users', 'u-seed-1');

      expect(staffQueue.getLine('s1').waiting[0]).toMatchObject({
        id: 'q-seed-1',
        patientName: null,
        dob: null,
        displayName: null,
      });
    });

    it('returns not-found for an unknown service', () => {
      expect(() => staffQueue.getLine('nope')).toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  describe('callNext', () => {
    it('calls the first patient and takes them out of the waiting line', () => {
      const { called } = staffQueue.callNext('s1');

      expect(called).toMatchObject({ id: 'q-seed-1', status: 'called', position: 0 });
      expect(called.calledAt).toEqual(expect.any(Number));

      const line = staffQueue.getLine('s1');
      expect(line.called.id).toBe('q-seed-1');
      expect(line.waiting).toHaveLength(5);
    });

    it('calls an urgent patient before earlier arrivals', () => {
      staffQueue.moveEntry('q-seed-4', { priority: 'urgent' });

      expect(staffQueue.callNext('s1').called.id).toBe('q-seed-4');
    });

    it('allows only one called patient per line', () => {
      staffQueue.callNext('s1');

      expect(() => staffQueue.callNext('s1')).toThrow(
        expect.objectContaining({ status: 409, code: 'already-calling' })
      );
    });

    it('rejects an empty line', () => {
      expect(() => staffQueue.callNext('s5')).toThrow(
        expect.objectContaining({ status: 409, code: 'empty' })
      );
    });
  });

  describe('resolveCalled', () => {
    it('records a seen visit in history and frees the line', () => {
      staffQueue.callNext('s1');
      const { resolved } = staffQueue.resolveCalled('s1', 'seen');

      expect(resolved.id).toBe('q-seed-1');
      expect(db.find('queueEntries', 'q-seed-1')).toBeNull();
      expect(staffQueue.getLine('s1').called).toBeNull();
      expect(todaysStats('s1')).toMatchObject({
        served: 1,
        currentlyWaiting: 5,
        averageWaitMinutes: expect.any(Number),
      });
    });

    it('records a no-show', () => {
      staffQueue.callNext('s2');
      staffQueue.resolveCalled('s2', 'no-show');

      expect(todaysStats('s2')).toMatchObject({ served: 0, noShows: 1 });
    });

    it('rejects a resolve when nobody is called', () => {
      expect(() => staffQueue.resolveCalled('s1', 'seen')).toThrow(
        expect.objectContaining({ status: 409, code: 'nothing-called' })
      );
    });
  });

  describe('moveEntry', () => {
    it('moves a patient down by swapping with the next patient', () => {
      const line = staffQueue.moveEntry('q-seed-1', { direction: 1 });

      expect(ids(line).slice(0, 3)).toEqual(['q-seed-2', 'q-seed-1', 'q-seed-3']);
    });

    it('changes nothing at the top of the line', () => {
      const line = staffQueue.moveEntry('q-seed-1', { direction: -1 });

      expect(ids(line)[0]).toBe('q-seed-1');
    });

    it('changes nothing for a patient who is already called', () => {
      staffQueue.callNext('s1');
      const line = staffQueue.moveEntry('q-seed-1', { direction: 1 });

      expect(ids(line)).toEqual(['q-seed-2', 'q-seed-3', 'q-seed-4', 'q-seed-5', 'q-seed-6']);
      expect(db.find('queueEntries', 'q-seed-1').status).toBe('called');
    });

    it('never moves a normal patient past an urgent one', () => {
      staffQueue.moveEntry('q-seed-2', { priority: 'urgent' });
      const line = staffQueue.moveEntry('q-seed-1', { direction: -1 });

      expect(ids(line).slice(0, 2)).toEqual(['q-seed-2', 'q-seed-1']);
    });

    it('marking a patient urgent moves them to the front', () => {
      const line = staffQueue.moveEntry('q-seed-5', { priority: 'urgent' });

      expect(line.waiting[0]).toMatchObject({ id: 'q-seed-5', priority: 'urgent', position: 1 });
    });

    it('returns not-found for an unknown entry', () => {
      expect(() => staffQueue.moveEntry('nope', { direction: 1 })).toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  describe('removeEntry', () => {
    it('takes a patient out of line and records it in history', () => {
      staffQueue.removeEntry('q-seed-3');

      expect(ids(staffQueue.getLine('s1'))).not.toContain('q-seed-3');
      expect(todaysStats('s1')).toMatchObject({ removed: 1, currentlyWaiting: 5 });
    });

    it('returns not-found for an unknown entry', () => {
      expect(() => staffQueue.removeEntry('nope')).toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });
});
