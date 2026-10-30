import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// GET /api/manager/bookings (MANAGER only)
router.get(
  '/bookings',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const managerId = req.user!.id;
      const { status } = req.query;

      const whereClauses = ['p.manager_id = $1'];
      const params: unknown[] = [managerId];

      if (status && typeof status === 'string' && status.trim() !== '') {
        whereClauses.push('b.status = $2');
        params.push(status.trim().toUpperCase());
      }

      const sql = `
        SELECT
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
            'price', p.price::float
          ) AS property,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email
          ) AS tenant
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        JOIN users u ON u.id = b.tenant_id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY b.created_at DESC
      `;

      const { rows } = await query(sql, params);
      res.status(200).json({ bookings: rows });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
