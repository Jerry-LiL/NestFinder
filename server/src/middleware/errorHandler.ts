import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  // Postgres unique constraint violation
  if (err.code === '23505') {
    res.status(409).json({
      error: 'Conflict: Record already exists with these details',
      details: err.detail,
    });
    return;
  }

  // Postgres exclusion constraint violation (e.g. overlapping booking)
  if (err.code === '23P01') {
    res.status(409).json({
      error: 'Conflict: An overlapping approved booking already exists for this property',
    });
    return;
  }

  // Postgres foreign key constraint violation
  if (err.code === '23503') {
    res.status(400).json({
      error: 'Invalid reference: Associated resource does not exist',
      details: err.detail,
    });
    return;
  }

  // Postgres check constraint violation
  if (err.code === '23514') {
    res.status(400).json({
      error: 'Invalid data: Constraints violated',
      details: err.detail,
    });
    return;
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('Server error:', err);
  }

  res.status(statusCode).json({
    error: message,
    ...(err.details ? { details: err.details } : {}),
  });
}
