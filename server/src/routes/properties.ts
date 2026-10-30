import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { query } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { saveFile } from '../services/storage';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const propertyInputSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().positive('Price must be greater than 0'),
  address: z.string().min(3, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  zipCode: z.string().min(2, 'Zip code is required'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  propertyType: z.enum(['APARTMENT', 'HOUSE', 'STUDIO', 'VILLA'], {
    errorMap: () => ({ message: 'Valid property types are APARTMENT, HOUSE, STUDIO, VILLA' }),
  }),
  beds: z.coerce.number().int().min(0, 'Beds must be 0 or greater'),
  baths: z.coerce.number().int().min(0, 'Baths must be 0 or greater'),
  sqft: z.coerce.number().int().positive('Sqft must be greater than 0'),
  amenities: z.array(z.string()).optional().default([]),
  images: z.array(z.string().url()).optional(),
});

const propertyUpdateSchema = propertyInputSchema.partial();

// GET /api/properties (Public search with filters)
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      city,
      minPrice,
      maxPrice,
      beds,
      type,
      amenities,
      availableFrom,
      availableTo,
      minLat,
      maxLat,
      minLng,
      maxLng,
      sort,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const whereClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (city && typeof city === 'string' && city.trim() !== '') {
      whereClauses.push(`LOWER(p.city) = LOWER($${paramIndex})`);
      params.push(city.trim());
      paramIndex++;
    }

    if (minPrice !== undefined && minPrice !== '') {
      const min = Number(minPrice);
      if (!isNaN(min)) {
        whereClauses.push(`p.price >= $${paramIndex}`);
        params.push(min);
        paramIndex++;
      }
    }

    if (maxPrice !== undefined && maxPrice !== '') {
      const max = Number(maxPrice);
      if (!isNaN(max)) {
        whereClauses.push(`p.price <= $${paramIndex}`);
        params.push(max);
        paramIndex++;
      }
    }

    if (beds !== undefined && beds !== '') {
      const minBeds = parseInt(beds as string, 10);
      if (!isNaN(minBeds)) {
        whereClauses.push(`p.beds >= $${paramIndex}`);
        params.push(minBeds);
        paramIndex++;
      }
    }

    if (type && typeof type === 'string' && type.trim() !== '') {
      whereClauses.push(`p.property_type = $${paramIndex}`);
      params.push(type.trim().toUpperCase());
      paramIndex++;
    }

    if (amenities && typeof amenities === 'string' && amenities.trim() !== '') {
      const list = amenities.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
      if (list.length > 0) {
        whereClauses.push(`p.amenities @> $${paramIndex}::text[]`);
        params.push(list);
        paramIndex++;
      }
    }

    // Availability filter: exclude properties that have an APPROVED booking overlapping the requested window.
    // Note: We use APPROVED bookings only because PENDING bookings may be rejected or cancelled.
    if (availableFrom && availableTo) {
      whereClauses.push(`
        NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.property_id = p.id
            AND b.status = 'APPROVED'
            AND daterange(b.start_date, b.end_date) && daterange($${paramIndex}::date, $${paramIndex + 1}::date)
        )
      `);
      params.push(availableFrom, availableTo);
      paramIndex += 2;
    }

    // Map bounds
    if (minLat !== undefined && maxLat !== undefined && minLng !== undefined && maxLng !== undefined) {
      const minLt = Number(minLat);
      const maxLt = Number(maxLat);
      const minLg = Number(minLng);
      const maxLg = Number(maxLng);
      if (!isNaN(minLt) && !isNaN(maxLt) && !isNaN(minLg) && !isNaN(maxLg)) {
        whereClauses.push(
          `p.latitude >= $${paramIndex} AND p.latitude <= $${paramIndex + 1} AND p.longitude >= $${paramIndex + 2} AND p.longitude <= $${paramIndex + 3}`
        );
        params.push(minLt, maxLt, minLg, maxLg);
        paramIndex += 4;
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let orderSql = 'ORDER BY p.created_at DESC, p.id DESC';
    if (sort === 'price_asc') {
      orderSql = 'ORDER BY p.price ASC, p.id ASC';
    } else if (sort === 'price_desc') {
      orderSql = 'ORDER BY p.price DESC, p.id DESC';
    } else if (sort === 'beds_desc') {
      orderSql = 'ORDER BY p.beds DESC, p.id DESC';
    } else if (sort === 'created_asc') {
      orderSql = 'ORDER BY p.created_at ASC, p.id ASC';
    }

    const countQuery = `SELECT COUNT(*) AS total FROM properties p ${whereSql}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT
        p.id,
        p.manager_id AS "managerId",
        p.title,
        p.description,
        p.price::float AS price,
        p.address,
        p.city,
        p.state,
        p.zip_code AS "zipCode",
        p.latitude,
        p.longitude,
        p.property_type AS "propertyType",
        p.beds,
        p.baths,
        p.sqft,
        p.amenities,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pi.id,
                'url', pi.url,
                'isPrimary', pi.is_primary
              ) ORDER BY pi.is_primary DESC, pi.id ASC
            )
            FROM property_images pi
            WHERE pi.property_id = p.id
          ),
          '[]'::json
        ) AS images
      FROM properties p
      ${whereSql}
      ${orderSql}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const dataParams = [...params, limitNum, offset];
    const { rows } = await query(dataQuery, dataParams);

    res.status(200).json({
      properties: rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/properties/:id (Public property detail)
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid property ID' });
      return;
    }

    const { rows } = await query(
      `SELECT
        p.id,
        p.manager_id AS "managerId",
        p.title,
        p.description,
        p.price::float AS price,
        p.address,
        p.city,
        p.state,
        p.zip_code AS "zipCode",
        p.latitude,
        p.longitude,
        p.property_type AS "propertyType",
        p.beds,
        p.baths,
        p.sqft,
        p.amenities,
        p.created_at AS "createdAt",
        p.updated_at AS "updatedAt",
        json_build_object('id', u.id, 'name', u.name, 'email', u.email) AS manager,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', pi.id,
                'url', pi.url,
                'isPrimary', pi.is_primary,
                'createdAt', pi.created_at
              ) ORDER BY pi.is_primary DESC, pi.id ASC
            )
            FROM property_images pi
            WHERE pi.property_id = p.id
          ),
          '[]'::json
        ) AS images
      FROM properties p
      JOIN users u ON u.id = p.manager_id
      WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    res.status(200).json({ property: rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/properties (MANAGER only)
router.post(
  '/',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = propertyInputSchema.parse(req.body);
      const managerId = req.user!.id;

      const { rows } = await query(
        `INSERT INTO properties (
          manager_id, title, description, price, address, city, state, zip_code,
          latitude, longitude, property_type, beds, baths, sqft, amenities
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING
          id, manager_id AS "managerId", title, description, price::float AS price,
          address, city, state, zip_code AS "zipCode", latitude, longitude,
          property_type AS "propertyType", beds, baths, sqft, amenities,
          created_at AS "createdAt", updated_at AS "updatedAt"`,
        [
          managerId,
          data.title,
          data.description,
          data.price,
          data.address,
          data.city,
          data.state,
          data.zipCode,
          data.latitude,
          data.longitude,
          data.propertyType,
          data.beds,
          data.baths,
          data.sqft,
          data.amenities.map((a) => a.toLowerCase().trim()),
        ]
      );

      const property = rows[0];
      const insertedImages: Array<{ id: number; url: string; isPrimary: boolean }> = [];

      if (data.images && data.images.length > 0) {
        for (let i = 0; i < data.images.length; i++) {
          const imgUrl = data.images[i];
          const isPrimary = i === 0;
          const imgResult = await query(
            `INSERT INTO property_images (property_id, url, is_primary)
             VALUES ($1, $2, $3)
             RETURNING id, url, is_primary AS "isPrimary"`,
            [property.id, imgUrl, isPrimary]
          );
          insertedImages.push(imgResult.rows[0]);
        }
      }

      property.images = insertedImages;
      res.status(201).json({ property });
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /api/properties/:id (MANAGER owner only)
router.patch(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid property ID' });
        return;
      }

      const existing = await query('SELECT manager_id FROM properties WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      if (existing.rows[0].manager_id !== req.user!.id) {
        res.status(403).json({ error: 'Forbidden: You do not own this property' });
        return;
      }

      const data = propertyUpdateSchema.parse(req.body);
      const updates: string[] = [];
      const params: unknown[] = [];
      let pIndex = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${pIndex++}`);
        params.push(data.title);
      }
      if (data.description !== undefined) {
        updates.push(`description = $${pIndex++}`);
        params.push(data.description);
      }
      if (data.price !== undefined) {
        updates.push(`price = $${pIndex++}`);
        params.push(data.price);
      }
      if (data.address !== undefined) {
        updates.push(`address = $${pIndex++}`);
        params.push(data.address);
      }
      if (data.city !== undefined) {
        updates.push(`city = $${pIndex++}`);
        params.push(data.city);
      }
      if (data.state !== undefined) {
        updates.push(`state = $${pIndex++}`);
        params.push(data.state);
      }
      if (data.zipCode !== undefined) {
        updates.push(`zip_code = $${pIndex++}`);
        params.push(data.zipCode);
      }
      if (data.latitude !== undefined) {
        updates.push(`latitude = $${pIndex++}`);
        params.push(data.latitude);
      }
      if (data.longitude !== undefined) {
        updates.push(`longitude = $${pIndex++}`);
        params.push(data.longitude);
      }
      if (data.propertyType !== undefined) {
        updates.push(`property_type = $${pIndex++}`);
        params.push(data.propertyType);
      }
      if (data.beds !== undefined) {
        updates.push(`beds = $${pIndex++}`);
        params.push(data.beds);
      }
      if (data.baths !== undefined) {
        updates.push(`baths = $${pIndex++}`);
        params.push(data.baths);
      }
      if (data.sqft !== undefined) {
        updates.push(`sqft = $${pIndex++}`);
        params.push(data.sqft);
      }
      if (data.amenities !== undefined) {
        updates.push(`amenities = $${pIndex++}`);
        params.push(data.amenities.map((a) => a.toLowerCase().trim()));
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields provided to update' });
        return;
      }

      updates.push(`updated_at = NOW()`);
      params.push(id);

      const updateSql = `
        UPDATE properties
        SET ${updates.join(', ')}
        WHERE id = $${pIndex}
        RETURNING
          id, manager_id AS "managerId", title, description, price::float AS price,
          address, city, state, zip_code AS "zipCode", latitude, longitude,
          property_type AS "propertyType", beds, baths, sqft, amenities,
          created_at AS "createdAt", updated_at AS "updatedAt"
      `;

      const { rows } = await query(updateSql, params);
      res.status(200).json({ property: rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/properties/:id (MANAGER owner only)
router.delete(
  '/:id',
  requireAuth,
  requireRole('MANAGER'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid property ID' });
        return;
      }

      const existing = await query('SELECT manager_id FROM properties WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      if (existing.rows[0].manager_id !== req.user!.id) {
        res.status(403).json({ error: 'Forbidden: You do not own this property' });
        return;
      }

      await query('DELETE FROM properties WHERE id = $1', [id]);
      res.status(200).json({ message: 'Property deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/properties/:id/images (MANAGER owner only)
router.post(
  '/:id/images',
  requireAuth,
  requireRole('MANAGER'),
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid property ID' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No image file uploaded' });
        return;
      }

      const existing = await query('SELECT manager_id FROM properties WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      if (existing.rows[0].manager_id !== req.user!.id) {
        res.status(403).json({ error: 'Forbidden: You do not own this property' });
        return;
      }

      const imageUrl = await saveFile(req.file);

      // Check if property already has images; if not, make this one primary
      const imgCountRes = await query('SELECT COUNT(*) AS count FROM property_images WHERE property_id = $1', [id]);
      const isPrimary = parseInt(imgCountRes.rows[0].count, 10) === 0;

      const { rows } = await query(
        `INSERT INTO property_images (property_id, url, is_primary)
         VALUES ($1, $2, $3)
         RETURNING id, property_id AS "propertyId", url, is_primary AS "isPrimary", created_at AS "createdAt"`,
        [id, imageUrl, isPrimary]
      );

      res.status(201).json({ image: rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
