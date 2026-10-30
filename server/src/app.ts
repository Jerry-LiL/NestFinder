import express from 'express';
import cors from 'cors';
import path from 'node:path';
import authRoutes from './routes/auth';
import propertyRoutes from './routes/properties';
import bookingRoutes from './routes/bookings';
import managerRoutes from './routes/manager';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint (not counted toward the 12 core REST routes)
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Exactly 12 core API routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/manager', managerRoutes);

// Fallback 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler
app.use(errorHandler);
