import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export async function runMigrations(connectionString?: string): Promise<void> {
  const dbUrl = connectionString || process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/nestfinder';
  const pool = new Pool({ connectionString: dbUrl });

  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      const migrationsDir = path.join(__dirname, '../migrations');
      const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

      for (const file of files) {
        const { rows } = await client.query('SELECT name FROM schema_migrations WHERE name = $1', [file]);
        if (rows.length === 0) {
          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          await client.query('BEGIN');
          try {
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
            console.log(`Executed migration: ${file}`);
          } catch (err) {
            await client.query('ROLLBACK');
            throw err;
          }
        }
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
