import pg from 'pg';

let pool: pg.Pool | undefined;

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Database is not configured.');
  pool ??= new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  return pool;
}
