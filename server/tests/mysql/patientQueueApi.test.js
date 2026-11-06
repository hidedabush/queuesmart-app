import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { close, nextId, query } from '../../src/database/mysql.js';

import { errorHandler, notFoundHandler } from '../../src/api/middleware/errors.js';
import { patientQueueRoutes } from '../../src/api/routes/patientQueueRoutes.js';
import { patientServiceQueueRoutes } from '../../src/api/routes/patientServiceQueueRoutes.js';

import * as queueRepo from '../../src/database/repositories/queueRepo.js';
import * as servicesRepo from '../../src/database/repositories/servicesRepo.js';
import * as userRepo from '../../src/database/repositories/userRepo.js';

const tag = nextId('test');
const email = `${tag}@queuesmart.test`;
const serviceName = `Patient Queue API Test ${tag}`;
const jwtSecret = 'test-only-secret-for-patient-api';

let user;
let service;
let app;

function createPatientQueueApiTestApp() {
    const token = jwt.sign(
        { role: 'user' },
        jwtSecret,
        {
            subject: user.id,
            expiresIn: '1h',
        }
    );

    const testApp = express();
    testApp.use(express.json());

    // Supply a test token while retaining the real requireAuth middleware.
    testApp.use((req, res, next) => {
        req.headers.authorization = `Bearer ${token}`;
        next();
    });

    testApp.use('/services', patientServiceQueueRoutes);
    testApp.use('/queue', patientQueueRoutes);

    testApp.use(notFoundHandler);
    testApp.use(errorHandler);

    return testApp;
}

beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;

    user = await userRepo.insert({
        name: 'Patient API Test',
        dob: '1990-02-03',
        email,
        passwordHash: null,
        role: 'user',
    });

    service = await servicesRepo.insert({
        name: serviceName,
        description: 'Created for patient HTTP-to-MySQL integration testing.',
        expectedDuration: 15,
        priority: 'low',
        capacity: 5,
    });

    app = createPatientQueueApiTestApp();
});

afterAll(async () => {
    try {
        if (user) {
            await query('DELETE FROM user_credentials WHERE id = ?', [user.id]);
        }

        if (service) {
            await query('DELETE FROM services WHERE id = ?', [service.id]);
        }
    } finally {
        await close();
    }
});

describe('patient queue MySQL API integration', () => {
    it('persists a patient check-in through POST, GET, and DELETE requests', async () => {
        // 1. Submit a patient check-in through the actual HTTP route.
        const joined = await request(app)
            .post(`/services/${service.id}/queue`)
            .send({ reason: 'New cough' });

        expect(joined.status).toBe(201);

        expect(joined.body.entry).toMatchObject({
            serviceId: service.id,
            serviceName: service.name,
            reason: 'New cough',
            priority: 'normal',
            status: 'head-in',
        });

        const entryId = joined.body.entry.id;

        // 2. Verify that the patient entry was persisted in MySQL.
        const storedEntry = await queueRepo.findActiveByUser(user.id);

        expect(storedEntry).toMatchObject({
            id: entryId,
            userId: user.id,
            serviceId: service.id,
            reason: 'New cough',
            status: 'waiting',
        });

        // 3. Retrieve the active entry through the actual GET endpoint.
        const active = await request(app).get('/queue/me');

        expect(active.status).toBe(200);

        expect(active.body.entry).toMatchObject({
            id: entryId,
            serviceId: service.id,
            serviceName: service.name,
            reason: 'New cough',
            status: 'head-in',
        });

        // 4. Cancel through the actual patient DELETE endpoint.
        const cancelled = await request(app).delete('/queue/me');

        expect(cancelled.status).toBe(204);
        expect(cancelled.text).toBe('');

        // 5. Verify that cancellation was persisted in MySQL.
        const retainedEntry = await queueRepo.findById(entryId);

        expect(retainedEntry).toMatchObject({
            id: entryId,
            userId: user.id,
            serviceId: service.id,
            status: 'canceled',
        });

        expect(retainedEntry.leftAt).toEqual(expect.any(Number));

        // 6. Confirm that the patient no longer has an active entry.
        const empty = await request(app).get('/queue/me');

        expect(empty.status).toBe(200);
        expect(empty.body).toEqual({ entry: null });
    });
});
