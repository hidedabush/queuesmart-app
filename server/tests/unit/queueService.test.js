
import { beforeEach, describe, expect, it } from 'vitest';
import * as db from '../fakes/db.js';
import * as queueService from '../../src/api/services/queueService.js';
import { statsForDate, today } from '../../src/api/services/statsService.js';

beforeEach(() => {
  db.reset();
});

describe('patient queue service', () => {
  describe('joinQueue', () => {
    it('joins an open service and returns the patient entry', async () => {
      const result = await queueService.joinQueue(
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

    it('rejects a second active check-in for the same patient', async () => {
      await queueService.joinQueue('u-patient-test', 's1', 'First visit');

      await expect(queueService.joinQueue('u-patient-test', 's3', 'Second visit')).rejects.toThrow(expect.objectContaining({
        status: 409,
        code: 'already-checked-in',
      }));
    });

    it('rejects a closed service', async () => {
      await expect(queueService.joinQueue('u-patient-test', 's5', 'Prescription question')).rejects.toThrow(expect.objectContaining({
        status: 409,
        code: 'closed',
      }));
    });

    it('rejects a full service', async () => {
      // s4 begins with three entries; capacity is lowered to that count
      // to test the existing capacity guard without changing seed data.
      db.update('services', 's4', { capacity: 3 });

      await expect(queueService.joinQueue('u-patient-test', 's4', 'Vaccination')).rejects.toThrow(expect.objectContaining({
        status: 409,
        code: 'full',
      }));
    });

    it('returns not-found for an unknown service', async () => {
      await expect(queueService.joinQueue('u-patient-test', 'unknown-service', 'Visit')).rejects.toThrow(expect.objectContaining({
        status: 404,
        code: 'not-found',
      }));
    });
  });

  describe('getMyQueue', () => {
    it('returns the active entry for the requested patient', async () => {
      await queueService.joinQueue('u-patient-test', 's1', 'New cough');

      const result = await queueService.getMyQueue('u-patient-test');

      expect(result.entry).toMatchObject({
        serviceId: 's1',
        serviceName: 'Sick Visit',
        reason: 'New cough',
        status: 'waiting',
        position: 7,
        peopleAhead: 6,
      });
    });

    it('returns null when the patient has no active entry', async () => {
      expect(await queueService.getMyQueue('u-patient-test')).toBeNull();
    });

    it('does not return another patient’s entry', async () => {
      await queueService.joinQueue('u-patient-test', 's1', 'New cough');

      expect(await queueService.getMyQueue('u-other-patient')).toBeNull();
    });
    
    it('leaves finished visits out of the ordered patient line', async () => {
        db.insert('queueEntries', {
            id: 'q-served-test',
            userId: 'u-served',
            serviceId: 's1',
            reason: 'Seen earlier today',
            status: 'served',
            priority: 'normal',
            order: 1,
            arrivedAt: Date.now(),
            calledAt: Date.now(),
            leftAt: Date.now(),
        });

        await queueService.joinQueue('u-patient-test', 's1', 'New cough');

        const result = await queueService.getMyQueue('u-patient-test');

        expect(result.entry.position).toBe(7);
        expect(result.entry.peopleAhead).toBe(6);
    });

    it('returns position zero for a patient whose entry is called', async () => {
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

        const result = await queueService.getMyQueue('u-patient-test');

        expect(result.entry).toMatchObject({
            status: 'called',
            position: 0,
            peopleAhead: 0,
            estimatedWait: null,
        });
    });
  });

  describe('cancelQueue', () => {
    it('ends the active entry for the requested patient and keeps it as canceled', async () => {
      const { entry } = await queueService.joinQueue(
        'u-patient-test',
        's1',
        'New cough'
      );

      await queueService.cancelQueue('u-patient-test');

      expect(await queueService.getMyQueue('u-patient-test')).toBeNull();
      expect(db.find('queueEntries', entry.id)).toMatchObject({
        status: 'canceled',
        leftAt: expect.any(Number),
      });
    });

    it('lets the patient check in again after canceling', async () => {
      await queueService.joinQueue('u-patient-test', 's1', 'New cough');
      await queueService.cancelQueue('u-patient-test');

      const { entry } = await queueService.joinQueue('u-patient-test', 's3', 'Blood draw');

      expect(entry.serviceId).toBe('s3');
    });

    it('sends a check-in notification without the visit reason', async () => {
      await queueService.joinQueue('u-patient-test', 's1', 'Private reason');

      const [notification] = db.all('notifications').filter((row) => row.userId === 'u-patient-test');

      expect(notification).toMatchObject({
        title: 'Sick Visit: checked in',
        message: 'You are number 7 in line. We will tell you when it is your turn.',
        status: 'sent',
      });
      expect(JSON.stringify(notification)).not.toContain('Private reason');
    });

    it('rejects cancellation when the patient has no active entry', async () => {
      await expect(queueService.cancelQueue('u-patient-test')).rejects.toThrow(
        expect.objectContaining({
          status: 404,
          code: 'not-found',
        })
      );
    });

    it('records a cancelled visit in history', async () => {
      await queueService.joinQueue('u-patient-test', 's1', 'New cough');
      await queueService.cancelQueue('u-patient-test');

      const row = (await statsForDate(today())).services.find((r) => r.serviceId === 's1');
      expect(row.cancelled).toBe(1);
    });
  });
});
