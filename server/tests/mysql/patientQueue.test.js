import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { close, nextId, query } from '../../src/database/mysql.js';

import * as historyRepo from '../../src/database/repositories/historyRepo.js';
import * as queueRepo from '../../src/database/repositories/queueRepo.js';
import * as servicesRepo from '../../src/database/repositories/servicesRepo.js';
import * as userRepo from '../../src/database/repositories/userRepo.js';

import * as queueService from '../../src/api/services/queueService.js';

const tag = nextId('test');
const email = `${tag}@queuesmart.test`;
const serviceName = `Patient Queue Test ${tag}`;

let user;
let calledUser;
let service;
let alternateService;

beforeAll(async () => {
    user = await userRepo.insert({
        name: 'Patient Queue Test',
        dob: '1990-02-03',
        email,
        passwordHash: null,
        role: 'user',
    });

    calledUser = await userRepo.insert({
        name: 'Called Patient Test',
        dob: '1992-04-05',
        email: `${tag}-called@queuesmart.test`,
        passwordHash: null,
        role: 'user',
    });

    service = await servicesRepo.insert({
        name: serviceName,
        description: 'Created for patient queue integration testing.',
        expectedDuration: 15,
        priority: 'low',
        capacity: 5,
    });

    alternateService = await servicesRepo.insert({
        name: `${serviceName} Alternate`,
        description: 'Created for cross-service patient queue testing.',
        expectedDuration: 15,
        priority: 'low',
        capacity: 5,
    });
});

afterAll(async () => {
    try {
        if (user) {
            await query('DELETE FROM user_credentials WHERE id = ?', [user.id]);
        }

        if (calledUser) {
            await query('DELETE FROM user_credentials WHERE id = ?', [calledUser.id]);
        }

        if (service) {
            await query('DELETE FROM services WHERE id = ?', [service.id]);
        }

        if (alternateService) {
            await query('DELETE FROM services WHERE id = ?', [alternateService.id]);
        }
    } finally {
        await close();
    }
});

describe('patient queue database integration', () => {
    it('joins, retrieves, cancels, preserves history, and allows re-entry', async () => {
        // 1. Join the queue.
        const joined = await queueService.joinQueue(
            user.id,
            service.id,
            'New cough'
        );

        expect(joined.entry).toMatchObject({
            serviceId: service.id,
            serviceName: service.name,
            reason: 'New cough',
        });

        const entryId = joined.entry.id;

        // 2. Retrieve the patient's active queue entry.
        const active = await queueService.getMyQueue(user.id);

        expect(active.entry.id).toBe(entryId);

        // The patient cannot join a second service while already checked in.
        await expect(
            queueService.joinQueue(
                user.id,
                alternateService.id,
                'Another visit'
            )
        ).rejects.toMatchObject({
            status: 409,
            code: 'already-checked-in',
        });

        const storedBeforeCancellation = await queueRepo.findById(entryId);

        expect(storedBeforeCancellation).toMatchObject({
            id: entryId,
            userId: user.id,
            serviceId: service.id,
            status: 'waiting',
            reason: 'New cough',
        });

        // 3. Cancel the check-in.
        await queueService.cancelQueue(user.id);

        // 4. Verify that the database retained the finished entry.
        const retainedEntry = await queueRepo.findById(entryId);

        expect(retainedEntry).toMatchObject({
            id: entryId,
            userId: user.id,
            serviceId: service.id,
            status: 'canceled',
        });

        expect(retainedEntry.leftAt).toEqual(expect.any(Number));

        // 5. Verify that the patient no longer has an active entry.
        expect(await queueService.getMyQueue(user.id)).toBeNull();

        // 6. Verify that the cancellation was recorded in visit history.
        const history = await historyRepo.listByUser(user.id);

        const cancellation = history.find(
            (row) =>
                row.serviceId === service.id &&
                row.outcome === 'cancelled'
        );

        expect(cancellation).toMatchObject({
            userId: user.id,
            serviceId: service.id,
            serviceName: service.name,
            joinedAt: joined.entry.arrivedAt,
            outcome: 'cancelled',
        });

        expect(cancellation.leftAt).toEqual(expect.any(Number));
        expect(cancellation.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        // 7. Verify that the patient can join again.
        const rejoined = await queueService.joinQueue(
            user.id,
            service.id,
            'Follow-up visit'
        );

        expect(rejoined.entry.id).not.toBe(entryId);
        expect(rejoined.entry.serviceId).toBe(service.id);

        const activeAgain = await queueService.getMyQueue(user.id);

        expect(activeAgain.entry.id).toBe(rejoined.entry.id);
    });

    it('retrieves a called patient entry with its recorded call time', async () => {
        // 1. Join the queue.
        const joined = await queueService.joinQueue(
            calledUser.id,
            service.id,
            'Follow-up consultation'
        );

        const entryId = joined.entry.id;

        // 2. Simulate the database transition to called.
        // The database trigger automatically records calledAt.
        const calledEntry = await queueRepo.update(entryId, {
            status: 'called',
        });

        expect(calledEntry.status).toBe('called');
        expect(calledEntry.calledAt).toEqual(expect.any(Number));

        // 3. Retrieve the patient's active entry through the patient service.
        const active = await queueService.getMyQueue(calledUser.id);

        expect(active.entry).toMatchObject({
            id: entryId,
            serviceId: service.id,
            serviceName: service.name,
            status: 'called',
            position: 0,
            peopleAhead: 0,
            estimatedWait: null,
        });

        expect(active.entry.calledAt).toEqual(expect.any(Number));
    });
});