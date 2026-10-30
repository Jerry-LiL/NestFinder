import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { query } from '../db';

describe('Bookings Endpoints & Constraints', () => {
  let managerToken: string;
  let otherManagerToken: string;
  let tenantToken: string;
  let otherTenantToken: string;
  let propertyId: number;

  beforeEach(async () => {
    await query('TRUNCATE users, properties, property_images, bookings RESTART IDENTITY CASCADE');

    const m = await request(app).post('/api/auth/register').send({
      name: 'Manager Aarav',
      email: 'manager@example.com',
      password: 'password123',
      role: 'MANAGER',
    });
    managerToken = m.body.token;

    const m2 = await request(app).post('/api/auth/register').send({
      name: 'Manager Other',
      email: 'othermanager@example.com',
      password: 'password123',
      role: 'MANAGER',
    });
    otherManagerToken = m2.body.token;

    const t1 = await request(app).post('/api/auth/register').send({
      name: 'Tenant Priya',
      email: 'tenant1@example.com',
      password: 'password123',
      role: 'TENANT',
    });
    tenantToken = t1.body.token;

    const t2 = await request(app).post('/api/auth/register').send({
      name: 'Tenant Rahul',
      email: 'tenant2@example.com',
      password: 'password123',
      role: 'TENANT',
    });
    otherTenantToken = t2.body.token;

    const p = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Penthouse Suite',
        description: 'Luxury penthouse for booking tests.',
        price: 5000,
        address: '100 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400020',
        latitude: 18.944,
        longitude: 72.823,
        propertyType: 'APARTMENT',
        beds: 3,
        baths: 3,
        sqft: 2000,
      });
    propertyId = p.body.property.id;
  });

  describe('Role-based access & validation for booking creation', () => {
    it('allows a tenant to create a booking request', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          propertyId,
          startDate: '2026-11-01',
          endDate: '2026-11-05',
          message: 'Booking request test',
        });

      expect(res.status).toBe(201);
      expect(res.body.booking).toBeDefined();
      expect(res.body.booking.status).toBe('PENDING');
      expect(res.body.booking.totalPrice).toBe(20000); // 4 days * 5000
    });

    it('rejects booking creation by a property manager with 403', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          propertyId,
          startDate: '2026-11-01',
          endDate: '2026-11-05',
        });

      expect(res.status).toBe(403);
    });

    it('returns 400 when endDate is before or equal to startDate', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          propertyId,
          startDate: '2026-11-10',
          endDate: '2026-11-05',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('endDate must be after startDate');
    });
  });

  describe('Booking overlap prevention (409 on overlapping existing approved booking)', () => {
    beforeEach(async () => {
      // Create and approve an initial booking for 2026-12-01 to 2026-12-10
      const bRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          propertyId,
          startDate: '2026-12-01',
          endDate: '2026-12-10',
        });

      await request(app)
        .patch(`/api/bookings/${bRes.body.booking.id}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'APPROVED' });
    });

    it('returns 409 when creating a booking that overlaps an existing approved booking', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .send({
          propertyId,
          startDate: '2026-12-05',
          endDate: '2026-12-15',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('not available');
    });

    it('allows creating a non-overlapping booking', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .send({
          propertyId,
          startDate: '2026-12-10',
          endDate: '2026-12-15',
        });

      expect(res.status).toBe(201);
    });
  });

  describe('PostgreSQL GiST exclusion constraint at DB level', () => {
    it('actually rejects direct overlapping approved inserts with exclusion constraint violation (23P01)', async () => {
      const tenantRes = await query("SELECT id FROM users WHERE role = 'TENANT' LIMIT 1");
      const tId = tenantRes.rows[0].id;

      // First direct insert of an APPROVED booking
      await query(
        `INSERT INTO bookings (property_id, tenant_id, start_date, end_date, status, total_price)
         VALUES ($1, $2, '2026-07-01', '2026-07-10', 'APPROVED', 45000)`,
        [propertyId, tId]
      );

      // Second conflicting direct insert of an APPROVED booking
      let thrownError: any = null;
      try {
        await query(
          `INSERT INTO bookings (property_id, tenant_id, start_date, end_date, status, total_price)
           VALUES ($1, $2, '2026-07-05', '2026-07-15', 'APPROVED', 50000)`,
          [propertyId, tId]
        );
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).not.toBeNull();
      // Postgres error code 23P01 is exclusion_violation
      expect(thrownError.code).toBe('23P01');
      expect(thrownError.constraint).toBe('no_overlapping_approved_bookings');
    });
  });

  describe('Concurrent approvals of overlapping bookings', () => {
    it('ensures exactly one succeeds with 200 and the other returns 409', async () => {
      // Create two pending overlapping bookings
      const b1 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          propertyId,
          startDate: '2026-08-01',
          endDate: '2026-08-10',
        });

      const b2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .send({
          propertyId,
          startDate: '2026-08-05',
          endDate: '2026-08-15',
        });

      const b1Id = b1.body.booking.id;
      const b2Id = b2.body.booking.id;

      // Execute concurrent approval requests
      const [res1, res2] = await Promise.all([
        request(app)
          .patch(`/api/bookings/${b1Id}/status`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'APPROVED' }),
        request(app)
          .patch(`/api/bookings/${b2Id}/status`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({ status: 'APPROVED' }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Verify in DB that only one is APPROVED
      const approvedCountRes = await query(
        `SELECT COUNT(*) AS count FROM bookings
         WHERE property_id = $1 AND status = 'APPROVED' AND id IN ($2, $3)`,
        [propertyId, b1Id, b2Id]
      );
      expect(parseInt(approvedCountRes.rows[0].count, 10)).toBe(1);
    });
  });

  describe('Booking management and tenant cancellation', () => {
    let pendingBookingId: number;

    beforeEach(async () => {
      const b = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          propertyId,
          startDate: '2026-10-01',
          endDate: '2026-10-05',
        });
      pendingBookingId = b.body.booking.id;
    });

    it('prevents non-owner manager from approving', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${pendingBookingId}/status`)
        .set('Authorization', `Bearer ${otherManagerToken}`)
        .send({ status: 'APPROVED' });

      expect(res.status).toBe(403);
    });

    it('allows tenant to cancel their own pending booking', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${pendingBookingId}/status`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe('CANCELLED');
    });

    it('allows tenant to retrieve their bookings via GET /api/bookings/mine', async () => {
      const res = await request(app)
        .get('/api/bookings/mine')
        .set('Authorization', `Bearer ${tenantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings.length).toBeGreaterThanOrEqual(1);
      expect(res.body.bookings[0].property).toBeDefined();
    });

    it('allows manager to retrieve incoming bookings via GET /api/manager/bookings', async () => {
      const res = await request(app)
        .get('/api/manager/bookings?status=PENDING')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bookings.length).toBeGreaterThanOrEqual(1);
      expect(res.body.bookings[0].tenant).toBeDefined();
    });
  });
});
