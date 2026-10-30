import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/nestfinder_test'
    : process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/nestfinder';

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
