import { randomBytes } from 'node:crypto';
import { database } from '@/db/postgres';
import { checkPasswordHash, hashPassword } from './access';

export type ManagedUser = {
  id: string;
  username: string;
  passwordHash: string;
  sessionVersion: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export const validUsername = (value: string) => /^[a-z][a-z0-9_-]{2,31}$/.test(value) && value !== 'admin' && value !== 'guest';
export const validPassword = (value: string) => value.length >= 12 && value.length <= 256;
export const newPassword = () => randomBytes(24).toString('base64url');
export const passwordDigest = (password: string) => hashPassword(password, randomBytes(16).toString('hex'));

const fields = 'id, username, password_hash AS "passwordHash", session_version AS "sessionVersion", enabled, created_at AS "createdAt", updated_at AS "updatedAt"';

export const sessionCredential = (user: ManagedUser) => `${user.passwordHash}:${user.sessionVersion}`;

export async function userByName(username: string): Promise<ManagedUser | null> {
  const result = await database().query<ManagedUser>(`SELECT ${fields} FROM app_users WHERE username = $1`, [username]);
  return result.rows[0] ?? null;
}

export async function userById(id: string): Promise<ManagedUser | null> {
  const result = await database().query<ManagedUser>(`SELECT ${fields} FROM app_users WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function listUsers(): Promise<ManagedUser[]> {
  const result = await database().query<ManagedUser>(`SELECT ${fields} FROM app_users ORDER BY created_at DESC`);
  return result.rows;
}

export const verifyUserPassword = (user: ManagedUser, password: string) => user.enabled && checkPasswordHash(user.passwordHash, password);

export function publicUser(user: ManagedUser) {
  return { id: user.id, username: user.username, enabled: user.enabled, createdAt: user.createdAt, updatedAt: user.updatedAt };
}
