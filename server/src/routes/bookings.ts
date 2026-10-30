import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool, query } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const createBookingSchema = z.object({
  propertyId: z.coerce.number().int().positive('Valid propertyId is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format'),
  message: z.string().max(1000).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED', 'CANCELLED'], {
    errorMap: () => ({ message: "Status must be 'APPROVED', 'REJECTED', or 'CANCELLED'" }),
  }),
});

// POST /api/bookings (TENANT only)
router.post(
  '/',
  requireAuth,
  requireRole('TENANT'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = createBookingSchema.parse(req.body);
      const tenantId = req.user!.id;

      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({ error: 'Invalid start or end date' });
        return;
      }

      if (end <= start) {
        res.status(400).json({ error: 'endDate must be after startDate' });
        return;
      }

      const propRes = await query('SELECT id, price FROM properties WHERE id = $1', [data.propertyId]);
      if (propRes.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const property = propRes.rows[0];

      // Check if property is available: reject if an overlapping APPROVED booking exists
      const conflictRes = await query(
        `SELECT id FROM bookings
         WHERE property_id = $1
           AND status = 'APPROVED'
           AND daterange(start_date, end_date) && daterange($2::date, $3::date)`,
        [data.propertyId, data.startDate, data.endDate]
      );

      if (conflictRes.rows.length > 0) {
        res.status(409).json({ error: 'Property is not available for the selected dates' });
        return;
      }

      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const totalPrice = Number((days * Number(property.price)).toFixed(2));

      const { rows } = await query(
        `INSERT INTO bookings (property_id, tenant_id, start_date, end_date, status, total_price, message)
         VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
         RETURNING
           id, property_id AS "propertyId", tenant_id AS "tenantId",
           start_date AS "startDate", end_date AS "endDate",
           status, total_price::float AS "totalPrice", message,
           created_at AS "createdAt", updated_at AS "updatedAt"`,
        [data.propertyId, tenantId, data.startDate, data.endDate, totalPrice, data.message || null]
      );

      res.status(201).json({ booking: rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/bookings/mine (TENANT only)
router.get(
  '/mine',
  requireAuth,
  requireRole('TENANT'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.user!.id;

      const { rows } = await query(
        `SELECT
          b.id,
          b.property_id AS "propertyId",
          b.tenant_id AS "tenantId",
          TO_CHAR(b.start_date, 'YYYY-MM-DD') AS "startDate",
          TO_CHAR(b.end_date, 'YYYY-MM-DD') AS "endDate",
          b.status,
          b.total_price::float AS "totalPrice",
          b.message,
          b.created_at AS "createdAt",
          b.updated_at AS "updatedAt",
          json_build_object(
            'id', p.id,
            'title', p.title,
            'city', p.city,
            'state', p.state,
            'address', p.address,
            'price', p.price::float,
            'propertyType', p.property_type,
            'primaryImage', (
              SELECT pi.url
              FROM property_images pi
              WHERE pi.property_id = p.id
              ORDER BY pi.is_primary DESC, pi.id ASC
              LIMIT 1
            )
          ) AS property
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        WHERE b.tenant_id = $1
        ORDER BY b.created_at DESC`,
        [tenantId]
      );

      res.status(200).json({ bookings: rows });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/bookings/:id/status (MANAGER owner or TENANT self-cancellation)
router.patch(
  '/:id/status',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const client = await pool.connect();
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid booking ID' });
        return;
      }

      const { status: targetStatus } = updateStatusSchema.parse(req.body);

      await client.query('BEGIN');

      const bookingRes = await client.query(
        `SELECT
           b.id, b.property_id, b.tenant_id,
           TO_CHAR(b.start_date, 'YYYY-MM-DD') AS start_date,
           TO_CHAR(b.end_date, 'YYYY-MM-DD') AS end_date,
           b.status, b.total_price, b.message,
           p.manager_id
         FROM bookings b
         JOIN properties p ON p.id = b.property_id
         WHERE b.id = $1
         FOR UPDATE`,
        [id]
      );

      if (bookingRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Booking not found' });
        return;
      }

      const booking = bookingRes.rows[0];

      if (req.user!.role === 'TENANT') {
        if (booking.tenant_id !== req.user!.id) {
          await client.query('ROLLBACK');
          res.status(403).json({ error: 'Forbidden: You do not own this booking' });
          return;
        }

        if (targetStatus !== 'CANCELLED') {
          await client.query('ROLLBACK');
          res.status(400).json({ error: 'Tenants may only set booking status to CANCELLED' });
          return;
        }

        if (booking.status !== 'PENDING') {
          await client.query('ROLLBACK');
          res.status(400).json({ error: 'Only pending bookings can be cancelled by tenant' });
          return;
        }
      } else if (req.user!.role === 'MANAGER') {
        if (booking.manager_id !== req.user!.id) {
          await client.query('ROLLBACK');
          res.status(403).json({ error: 'Forbidden: You do not own the property for this booking' });
          return;
        }

        if (targetStatus !== 'APPROVED' && targetStatus !== 'REJECTED') {
          await client.query('ROLLBACK');
          res.status(400).json({ error: "Managers may only set status to 'APPROVED' or 'REJECTED'" });
          return;
        }

        if (targetStatus === 'APPROVED') {
          // Check for existing overlapping approved booking
          const conflictRes = await client.query(
            `SELECT id FROM bookings
             WHERE property_id = $1
               AND status = 'APPROVED'
               AND id != $2
               AND daterange(start_date, end_date) && daterange($3::date, $4::date)`,
            [booking.property_id, id, booking.start_date, booking.end_date]
          );

          if (conflictRes.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(409).json({ error: 'Cannot approve booking: an overlapping booking has already been approved' });
            return;
          }
        }
      }

      let updateRes;
      try {
        updateRes = await client.query(
          `UPDATE bookings
           SET status = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING
             id, property_id AS "propertyId", tenant_id AS "tenantId",
             TO_CHAR(start_date, 'YYYY-MM-DD') AS "startDate",
             TO_CHAR(end_date, 'YYYY-MM-DD') AS "endDate",
             status, total_price::float AS "totalPrice", message,
             created_at AS "createdAt", updated_at AS "updatedAt"`,
          [targetStatus, id]
        );
      } catch (err: any) {
        if (err.code === '23P01') {
          await client.query('ROLLBACK');
          res.status(409).json({ error: 'Cannot approve booking: an overlapping booking has already been approved' });
          return;
        }
        throw err;
      }

      await client.query('COMMIT');
      res.status(200).json({ booking: updateRes.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally {
      client.release();
    }
  }
);

export default router;
