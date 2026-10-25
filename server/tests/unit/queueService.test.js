
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../../src/database/db.js';
import * as queueService from '../../src/api/services/queueService.js';
import { statsForDate, today } from '../../src/api/services/statsService.js';

beforeEach(() => {
  db.reset();
});

describe('patient queue service', () => {
  describe('joinQueue', () => {
    it('joins an open service and returns the patient entry', () => {
      const result = queueService.joinQueue(
        'u-patient-test',
        's1',
        '  New cough  '
      );

      expect(result.entry).toMatchObject({
        serviceId: 's1',
        serviceName: 'Sick Visit',
        reason: 'New cough',
        priority: 'normal',
        status: 'waiting',
        position: 7,
        peopleAhead: 6,
        estimatedWait: { low: 90, high: 117 },
        calledAt: null,
      });

      expect(result.entry.id).toBeTruthy();
      expect(result.entry.arrivedAt).toEqual(expect.any(Number));
    });

    it('rejects a second active check-in for the same patient', () => {
      queueService.joinQueue('u-patient-test', 's1', 'First visit');

      expect(() =>
        queueService.joinQueue('u-patient-test', 's3', 'Second visit')
      ).toThrow(expect.objectContaining({
        status: 409,
        code: 'already-checked-in',
      }));
    });

    it('rejects a closed service', () => {
      expect(() =>
        queueService.joinQueue('u-patient-test', 's5', 'Prescription question')
      ).toThrow(expect.objectContaining({
        status: 409,
        code: 'closed',
      }));
    });

    it('rejects a full service', () => {
      // s4 begins with three entries; capacity is lowered to that count
      // to test the existing capacity guard without changing seed data.
      db.update('services', 's4', { capacity: 3 });

      expect(() =>
        queueService.joinQueue('u-patient-test', 's4', 'Vaccination')
      ).toThrow(expect.objectContaining({
        status: 409,
        code: 'full',
      }));
    });

    it('returns not-found for an unknown service', () => {
      expect(() =>
        queueService.joinQueue('u-patient-test', 'unknown-service', 'Visit')
      ).toThrow(expect.objectContaining({
        status: 404,
        code: 'not-found',
      }));
    });
  });

  describe('getMyQueue', () => {
    it('returns the active entry for the requested patient', () => {
      queueService.joinQueue('u-patient-test', 's1', 'New cough');

      const result = queueService.getMyQueue('u-patient-test');

      expect(result.entry).toMatchObject({
        serviceId: 's1',
        serviceName: 'Sick Visit',
        reason: 'New cough',
        status: 'waiting',
        position: 7,
        peopleAhead: 6,
      });
    });

    it('returns null when the patient has no active entry', () => {
      expect(queueService.getMyQueue('u-patient-test')).toBeNull();
    });

    it('does not return another patient’s entry', () => {
      queueService.joinQueue('u-patient-test', 's1', 'New cough');

      expect(queueService.getMyQueue('u-other-patient')).toBeNull();
    });
    
    it('includes a head-in entry in the ordered patient line', () => {
        db.insert('queueEntries', {
            id: 'q-head-in-test',
            userId: 'u-head-in',
            serviceId: 's1',
            reason: 'Already checked in',
            status: 'head-in',
            priority: 'normal',
            order: 1,
            arrivedAt: Date.now(),
            calledAt: null,
        });

        queueService.joinQueue('u-patient-test', 's1', 'New cough');

        const result = queueService.getMyQueue('u-patient-test');

        expect(result.entry.position).toBe(8);
        expect(result.entry.peopleAhead).toBe(7);
    });

    it('returns position zero for a patient whose entry is called', () => {
        db.insert('queueEntries', {
            id: 'q-called-test',
            userId: 'u-patient-test',
            serviceId: 's1',
            reason: 'Called for visit',
            status: 'called',
            priority: 'normal',
            order: 7,
            arrivedAt: Date.now(),
            calledAt: Date.now(),
        });

        const result = queueService.getMyQueue('u-patient-test');

        expect(result.entry).toMatchObject({
            status: 'called',
            position: 0,
            peopleAhead: 0,
            estimatedWait: null,
        });
    });
  });

  describe('cancelQueue', () => {
    it('removes the active entry for the requested patient', () => {
      const { entry } = queueService.joinQueue(
        'u-patient-test',
        's1',
        'New cough'
      );

      queueService.cancelQueue('u-patient-test');

      expect(queueService.getMyQueue('u-patient-test')).toBeNull();
      expect(db.find('queueEntries', entry.id)).toBeNull();
    });

    it('rejects cancellation when the patient has no active entry', () => {
      expect(() => queueService.cancelQueue('u-patient-test')).toThrow(
        expect.objectContaining({
          status: 404,
          code: 'not-found',
        })
      );
    });
  });
});

describe('staff queue service', () => {
  const ids = (line) => line.waiting.map((entry) => entry.id);
  const todaysStats = (serviceId) =>
    statsForDate(today()).services.find((row) => row.serviceId === serviceId);

  describe('getLine', () => {
    it('returns the ordered waiting line with positions and nobody called', () => {
      const line = queueService.getLine('s1');

      expect(line.called).toBeNull();
      expect(line.waiting).toHaveLength(6);
      expect(line.waiting[0]).toMatchObject({
        id: 'q-seed-1',
        position: 1,
        status: 'waiting',
        patientName: null,
      });
      expect(line.waiting.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('returns not-found for an unknown service', () => {
      expect(() => queueService.getLine('nope')).toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  describe('callNext', () => {
    it('calls the first patient and takes them out of the waiting line', () => {
      const { called } = queueService.callNext('s1');

      expect(called).toMatchObject({ id: 'q-seed-1', status: 'called', position: 0 });
      expect(called.calledAt).toEqual(expect.any(Number));

      const line = queueService.getLine('s1');
      expect(line.called.id).toBe('q-seed-1');
      expect(line.waiting).toHaveLength(5);
    });

    it('calls an urgent patient before earlier arrivals', () => {
      queueService.updateEntry('q-seed-4', { priority: 'urgent' });

      expect(queueService.callNext('s1').called.id).toBe('q-seed-4');
    });

    it('allows only one called patient per line', () => {
      queueService.callNext('s1');

      expect(() => queueService.callNext('s1')).toThrow(
        expect.objectContaining({ status: 409, code: 'already-calling' })
      );
    });

    it('rejects an empty line', () => {
      expect(() => queueService.callNext('s5')).toThrow(
        expect.objectContaining({ status: 409, code: 'empty' })
      );
    });
  });

  describe('resolveCalled', () => {
    it('records a seen visit in history and frees the line', () => {
      queueService.callNext('s1');
      const { resolved } = queueService.resolveCalled('s1', 'seen');

      expect(resolved.id).toBe('q-seed-1');
      expect(db.find('queueEntries', 'q-seed-1')).toBeNull();
      expect(queueService.getLine('s1').called).toBeNull();
      expect(todaysStats('s1')).toMatchObject({
        served: 1,
        currentlyWaiting: 5,
        averageWaitMinutes: expect.any(Number),
      });
    });

    it('records a no-show', () => {
      queueService.callNext('s2');
      queueService.resolveCalled('s2', 'no-show');

      expect(todaysStats('s2')).toMatchObject({ served: 0, noShows: 1 });
    });

    it('rejects a resolve when nobody is called', () => {
      expect(() => queueService.resolveCalled('s1', 'seen')).toThrow(
        expect.objectContaining({ status: 409, code: 'nothing-called' })
      );
    });
  });

  describe('updateEntry', () => {
    it('moves a patient down by swapping with the next patient', () => {
      const line = queueService.updateEntry('q-seed-1', { direction: 1 });

      expect(ids(line).slice(0, 3)).toEqual(['q-seed-2', 'q-seed-1', 'q-seed-3']);
    });

    it('changes nothing at the top of the line', () => {
      const line = queueService.updateEntry('q-seed-1', { direction: -1 });

      expect(ids(line)[0]).toBe('q-seed-1');
    });

    it('never moves a normal patient past an urgent one', () => {
      queueService.updateEntry('q-seed-2', { priority: 'urgent' });
      const line = queueService.updateEntry('q-seed-1', { direction: -1 });

      expect(ids(line).slice(0, 2)).toEqual(['q-seed-2', 'q-seed-1']);
    });

    it('marking a patient urgent moves them to the front', () => {
      const line = queueService.updateEntry('q-seed-5', { priority: 'urgent' });

      expect(line.waiting[0]).toMatchObject({ id: 'q-seed-5', priority: 'urgent', position: 1 });
    });

    it('returns not-found for an unknown entry', () => {
      expect(() => queueService.updateEntry('nope', { direction: 1 })).toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  describe('removeEntry', () => {
    it('takes a patient out of line and records it in history', () => {
      queueService.removeEntry('q-seed-3');

      expect(ids(queueService.getLine('s1'))).not.toContain('q-seed-3');
      expect(todaysStats('s1')).toMatchObject({ removed: 1, currentlyWaiting: 5 });
    });

    it('returns not-found for an unknown entry', () => {
      expect(() => queueService.removeEntry('nope')).toThrow(
        expect.objectContaining({ status: 404 })
      );
    });
  });

  it('a patient cancelling records a cancelled visit', () => {
    queueService.joinQueue('u-patient-test', 's1', 'New cough');
    queueService.cancelQueue('u-patient-test');

    expect(todaysStats('s1').cancelled).toBe(1);
  });
});
