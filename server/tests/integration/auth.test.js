import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { reset } from '../src/database/db.js';

const app = createApp();

describe('Authentication API', () => {
  beforeEach(() => {
    reset();
    process.env.JWT_SECRET = 'test-only-secret-for-queuesmart';
  });

  it('registers a new patient', async () => {
    const response = await request(app)
      .post('/auth/register')
      .send({
        name: 'Taylor Morgan',
        dob: '03/14/1995',
        email: 'taylor@example.com',
        password: 'Queue#2026',
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      name: 'Taylor Morgan',
      email: 'taylor@example.com',
      role: 'user',
    });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email address', async () => {
    const user = {
      name: 'Taylor Morgan',
      dob: '03/14/1995',
      email: 'taylor@example.com',
      password: 'Queue#2026',
    };

    await request(app).post('/auth/register').send(user);

    const response = await request(app)
      .post('/auth/register')
      .send({ ...user, email: 'TAYLOR@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('email-taken');
  });

  it('logs in with valid credentials', async () => {
    const user = {
      name: 'Taylor Morgan',
      dob: '03/14/1995',
      email: 'taylor@example.com',
      password: 'Queue#2026',
    };

    await request(app).post('/auth/register').send(user);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: user.email,
        password: user.password,
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('rejects an incorrect password', async () => {
    const user = {
      name: 'Taylor Morgan',
      dob: '03/14/1995',
      email: 'taylor@example.com',
      password: 'Queue#2026',
    };

    await request(app).post('/auth/register').send(user);

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: user.email,
        password: 'Wrong#2026',
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('unauthenticated');
  });

  it('requires a token to access the current-user endpoint', async () => {
    const response = await request(app).get('/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('unauthenticated');
  });

  it('returns the current user when given a valid token', async () => {
    const user = {
      name: 'Taylor Morgan',
      dob: '03/14/1995',
      email: 'taylor@example.com',
      password: 'Queue#2026',
    };

    await request(app).post('/auth/register').send(user);

    const login = await request(app)
      .post('/auth/login')
      .send({
        email: user.email,
        password: user.password,
      });

    const response = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(user.email);
    expect(response.body.user.id).toBe(login.body.user.id);
  });
});