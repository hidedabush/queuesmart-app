
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

    it('records a cancelled visit in history', () => {
      queueService.joinQueue('u-patient-test', 's1', 'New cough');
      queueService.cancelQueue('u-patient-test');

      const row = statsForDate(today()).services.find((r) => r.serviceId === 's1');
      expect(row.cancelled).toBe(1);
    });
  });
});
