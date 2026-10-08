import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
try {
  await pool.query(await readFile(new URL('../db/postgres.sql', import.meta.url), 'utf8'));
  process.stdout.write('Database schema ready\n');
} finally { await pool.end(); }
