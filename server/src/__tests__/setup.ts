import { beforeAll, afterAll } from 'vitest';
import { runMigrations } from '../migrate';
import { pool } from '../db';

const testDbUrl = process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/nestfinder_test';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await runMigrations(testDbUrl);
});

afterAll(async () => {
  await pool.end();
});
