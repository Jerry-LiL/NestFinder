import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { query } from '../db';

describe('Properties Endpoints', () => {
  let managerToken: string;
  let otherManagerToken: string;
  let tenantToken: string;
  let managerId: number;

  beforeEach(async () => {
    await query('TRUNCATE users, properties, property_images, bookings RESTART IDENTITY CASCADE');

    const m1 = await request(app).post('/api/auth/register').send({
      name: 'Manager One',
      email: 'm1@example.com',
      password: 'password123',
      role: 'MANAGER',
    });
    managerToken = m1.body.token;
    managerId = m1.body.user.id;

    const m2 = await request(app).post('/api/auth/register').send({
      name: 'Manager Two',
      email: 'm2@example.com',
      password: 'password123',
      role: 'MANAGER',
    });
    otherManagerToken = m2.body.token;

    const t = await request(app).post('/api/auth/register').send({
      name: 'Tenant One',
      email: 't1@example.com',
      password: 'password123',
      role: 'TENANT',
    });
    tenantToken = t.body.token;
  });

  describe('POST /api/properties', () => {
    it('allows a manager to create a listing', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Sunny 2BHK in Indiranagar',
          description: 'Spacious flat close to 100ft road and metro.',
          price: 35000,
          address: '12th Main, Indiranagar',
          city: 'Bengaluru',
          state: 'Karnataka',
          zipCode: '560038',
          latitude: 12.9784,
          longitude: 77.6408,
          propertyType: 'APARTMENT',
          beds: 2,
          baths: 2,
          sqft: 1100,
          amenities: ['wifi', 'parking', 'balcony'],
        });

      expect(res.status).toBe(201);
      expect(res.body.property).toBeDefined();
      expect(res.body.property.title).toBe('Sunny 2BHK in Indiranagar');
      expect(res.body.property.managerId).toBe(managerId);
    });

    it('rejects property creation from a tenant with 403', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({
          title: 'Tenant Attempt Listing',
          description: 'This should fail permissions check.',
          price: 25000,
          address: 'Some Street',
          city: 'Bengaluru',
          state: 'Karnataka',
          zipCode: '560001',
          latitude: 12.9716,
          longitude: 77.5946,
          propertyType: 'APARTMENT',
          beds: 1,
          baths: 1,
          sqft: 600,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/properties').send({
        title: 'No Auth Listing',
        description: 'Should fail authentication.',
        price: 20000,
        address: 'Some Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        zipCode: '400001',
        latitude: 19.076,
        longitude: 72.877,
        propertyType: 'STUDIO',
        beds: 1,
        baths: 1,
        sqft: 400,
      });

      expect(res.status).toBe(401);
    });

    it('validates schema constraints (price > 0, valid type)', async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Bad Property',
          description: 'Short',
          price: -500, // Invalid negative price
          address: 'Street',
          city: 'City',
          state: 'State',
          zipCode: '12',
          latitude: 200, // Invalid latitude
          longitude: 72.8,
          propertyType: 'CASTLE', // Invalid enum
          beds: -1,
          baths: 1,
          sqft: 0,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });
  });

  describe('GET /api/properties (Search & Filters)', () => {
    beforeEach(async () => {
      // Seed 3 test properties
      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Budget Studio in Bandra',
          description: 'Cozy modern studio near Bandstand.',
          price: 20000,
          address: 'Hill Road',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400050',
          latitude: 19.0544,
          longitude: 72.8285,
          propertyType: 'STUDIO',
          beds: 1,
          baths: 1,
          sqft: 450,
          amenities: ['wifi', 'parking'],
        });

      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Luxury 3BHK in Koramangala',
          description: 'High-end apartment with full amenities.',
          price: 60000,
          address: '4th Block',
          city: 'Bengaluru',
          state: 'Karnataka',
          zipCode: '560034',
          latitude: 12.9345,
          longitude: 77.6265,
          propertyType: 'APARTMENT',
          beds: 3,
          baths: 3,
          sqft: 1800,
          amenities: ['wifi', 'parking', 'gym', 'pool'],
        });

      await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Heritage Villa in Panaji',
          description: 'Stunning villa with private pool.',
          price: 90000,
          address: 'Fontainhas',
          city: 'Goa',
          state: 'Goa',
          zipCode: '403001',
          latitude: 15.4989,
          longitude: 73.8278,
          propertyType: 'VILLA',
          beds: 4,
          baths: 4,
          sqft: 3200,
          amenities: ['wifi', 'pool', 'security'],
        });
    });

    it('returns all properties without filters', async () => {
      const res = await request(app).get('/api/properties');
      expect(res.status).toBe(200);
      expect(res.body.properties.length).toBe(3);
      expect(res.body.total).toBe(3);
    });

    it('filters by city (case-insensitive)', async () => {
      const res = await request(app).get('/api/properties?city=bengaluru');
      expect(res.status).toBe(200);
      expect(res.body.properties.length).toBe(1);
      expect(res.body.properties[0].city).toBe('Bengaluru');
    });

    it('filters by price range', async () => {
      const res = await request(app).get('/api/properties?minPrice=30000&maxPrice=70000');
      expect(res.status).toBe(200);
      expect(res.body.properties.length).toBe(1);
      expect(res.body.properties[0].title).toContain('Koramangala');
    });

    it('filters by min beds and property type', async () => {
      const res = await request(app).get('/api/properties?beds=3&type=VILLA');
      expect(res.status).toBe(200);
      expect(res.body.properties.length).toBe(1);
      expect(res.body.properties[0].propertyType).toBe('VILLA');
    });

    it('filters by amenities requiring all listed amenities', async () => {
      // Must have both gym and pool
      const res = await request(app).get('/api/properties?amenities=gym,pool');
      expect(res.status).toBe(200);
      expect(res.body.properties.length).toBe(1);
      expect(res.body.properties[0].title).toContain('Koramangala');
    });
  });

  describe('PATCH & DELETE /api/properties/:id', () => {
    let propertyId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Original Title',
          description: 'Original description here.',
          price: 25000,
          address: 'Street',
          city: 'Pune',
          state: 'Maharashtra',
          zipCode: '411001',
          latitude: 18.5204,
          longitude: 73.8567,
          propertyType: 'APARTMENT',
          beds: 2,
          baths: 2,
          sqft: 900,
        });
      propertyId = res.body.property.id;
    });

    it('prevents non-owner manager from editing', async () => {
      const res = await request(app)
        .patch(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${otherManagerToken}`)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);
    });

    it('allows owner manager to update property', async () => {
      const res = await request(app)
        .patch(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Updated Title',
          price: 28000,
        });

      expect(res.status).toBe(200);
      expect(res.body.property.title).toBe('Updated Title');
      expect(res.body.property.price).toBe(28000);
    });

    it('allows owner manager to delete property', async () => {
      const res = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);

      const check = await request(app).get(`/api/properties/${propertyId}`);
      expect(check.status).toBe(404);
    });
  });

  describe('POST /api/properties/:id/images', () => {
    let propertyId: number;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          title: 'Image Test Property',
          description: 'Property to test multer upload.',
          price: 22000,
          address: 'Street',
          city: 'Delhi',
          state: 'Delhi',
          zipCode: '110001',
          latitude: 28.6139,
          longitude: 77.209,
          propertyType: 'APARTMENT',
          beds: 1,
          baths: 1,
          sqft: 500,
        });
      propertyId = res.body.property.id;
    });

    it('uploads an image file for the property', async () => {
      const buffer = Buffer.from('fake image content');
      const res = await request(app)
        .post(`/api/properties/${propertyId}/images`)
        .set('Authorization', `Bearer ${managerToken}`)
        .attach('image', buffer, 'livingroom.jpg');

      expect(res.status).toBe(201);
      expect(res.body.image).toBeDefined();
      expect(res.body.image.url).toContain('/uploads/');
      expect(res.body.image.isPrimary).toBe(true);
    });

    it('rejects image upload by non-owner with 403', async () => {
      const buffer = Buffer.from('fake image content');
      const res = await request(app)
        .post(`/api/properties/${propertyId}/images`)
        .set('Authorization', `Bearer ${otherManagerToken}`)
        .attach('image', buffer, 'livingroom.jpg');

      expect(res.status).toBe(403);
    });
  });
});
