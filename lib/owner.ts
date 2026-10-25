import { randomUUID } from 'node:crypto';
import { database } from '@/db/postgres';
import { checkPassword, checkPasswordHash } from './access';
import { passwordDigest } from './users';

export type OwnerCredentials = { username: string; passwordHash: string; sessionVersion: string };
const fields = 'username, password_hash AS "passwordHash", session_version AS "sessionVersion"';

export async function ownerCredentials(): Promise<OwnerCredentials | null> {
  const result = await database().query<OwnerCredentials>(`SELECT ${fields} FROM owner_credentials WHERE id = 1`);
  return result.rows[0] ?? null;
}

export const ownerSessionCredential = (owner: OwnerCredentials) => `${owner.passwordHash}:${owner.sessionVersion}`;

export function verifyOwnerPassword(owner: OwnerCredentials | null, password: string) {
  return owner ? checkPasswordHash(owner.passwordHash, password) : checkPassword('admin', password);
}

export async function updateOwnerCredentials(currentPassword: string, username: string, newPassword: string | null) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    // Serialize competing changes, including the first update before a row exists.
    await client.query('SELECT pg_advisory_xact_lock(472911)');
    const current = (await client.query<OwnerCredentials>(`SELECT ${fields} FROM owner_credentials WHERE id = 1`)).rows[0] ?? null;
    if (!verifyOwnerPassword(current, currentPassword)) throw new Error('Current password is incorrect.');
    if (username === 'guest' || (await client.query('SELECT 1 FROM app_users WHERE username = $1', [username])).rowCount) throw new Error('That username is already in use.');
    const passwordHash = newPassword ? passwordDigest(newPassword) : current?.passwordHash ?? process.env.VANTA_ADMIN_PASSWORD_HASH;
    if (!passwordHash) throw new Error('Admin sign-in is not configured.');
    const result = await client.query<OwnerCredentials>(`INSERT INTO owner_credentials (id, username, password_hash, session_version, updated_at)
      VALUES (1, $1, $2, $3, now())
      ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash,
      session_version = EXCLUDED.session_version, updated_at = now() RETURNING ${fields}`, [username, passwordHash, randomUUID()]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
