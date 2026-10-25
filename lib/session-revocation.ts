import { createHash } from 'node:crypto';
import { database } from '@/db/postgres';

function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }

export async function isSessionRevoked(token: string) {
  const result = await database().query('SELECT 1 FROM revoked_sessions WHERE token_hash = $1 AND expires_at > now()', [tokenHash(token)]);
  return !!result.rowCount;
}

export async function revokeSession(token: string) {
  await database().query(`INSERT INTO revoked_sessions (token_hash, expires_at) VALUES ($1, now() + interval '7 days')
    ON CONFLICT (token_hash) DO NOTHING`, [tokenHash(token)]);
  if (Math.random() < 0.01) await database().query('DELETE FROM revoked_sessions WHERE expires_at < now()').catch(() => {});
}
