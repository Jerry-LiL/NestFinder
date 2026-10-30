import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { query } from '../db';

describe('Auth Endpoints', () => {
  beforeEach(async () => {
    await query('TRUNCATE users, properties, property_images, bookings RESTART IDENTITY CASCADE');
  });

  describe('POST /api/auth/register', () => {
    it('registers a new tenant successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Priya Tenant',
          email: 'priya@example.com',
          password: 'password123',
          role: 'TENANT',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('priya@example.com');
      expect(res.body.user.role).toBe('TENANT');
      expect(res.body.token).toBeDefined();
    });

    it('registers a new property manager successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Aarav Manager',
          email: 'aarav@example.com',
          password: 'password123',
          role: 'MANAGER',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('MANAGER');
    });

    it('returns 400 for validation errors', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A',
          email: 'invalid-email',
          password: '123',
          role: 'ADMIN',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
      expect(res.body.details).toBeDefined();
    });

    it('returns 409 when registering an already registered email', async () => {
      await request(app).post('/api/auth/register').send({
        name: 'First User',
        email: 'duplicate@example.com',
        password: 'password123',
        role: 'TENANT',
      });

      const res = await request(app).post('/api/auth/register').send({
        name: 'Second User',
        email: 'duplicate@example.com',
        password: 'password456',
        role: 'MANAGER',
      });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Existing User',
        email: 'existing@example.com',
        password: 'password123',
        role: 'TENANT',
      });
    });

    it('logs in successfully with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('existing@example.com');
      expect(res.body.token).toBeDefined();
    });

    it('returns 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('returns 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'notfound@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });
});
