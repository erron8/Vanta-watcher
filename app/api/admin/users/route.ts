import { database } from '@/db/postgres';
import { denyNonAdmin } from '@/lib/authorize';
import { listUsers, newPassword, passwordDigest, publicUser, validPassword, validUsername, type ManagedUser } from '@/lib/users';

export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(request: Request) {
  const denied = await denyNonAdmin(request); if (denied) return denied;
  try {
    const users = await listUsers();
    return Response.json({ users: users.map(publicUser) }, { headers: privateHeaders });
  } catch { return Response.json({ error: 'Could not load users.' }, { status: 503, headers: privateHeaders }); }
}

export async function POST(request: Request) {
  const denied = await denyNonAdmin(request); if (denied) return denied;
  let body: { username?: unknown; password?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: 'Enter a username.' }, { status: 400, headers: privateHeaders }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Enter a username.' }, { status: 400, headers: privateHeaders });
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!validUsername(username)) return Response.json({ error: 'Use 3–32 lowercase letters, numbers, underscores, or hyphens. Start with a letter.' }, { status: 400, headers: privateHeaders });
  if (body.password !== undefined && (typeof body.password !== 'string' || !validPassword(body.password))) return Response.json({ error: 'Password must be 12–256 characters.' }, { status: 400, headers: privateHeaders });
  const password = typeof body.password === 'string' ? body.password : newPassword();
  const client = await database().connect().catch(() => null);
  if (!client) return Response.json({ error: 'Could not connect to user storage.' }, { status: 503, headers: privateHeaders });
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(472911)');
    if ((await client.query('SELECT 1 FROM owner_credentials WHERE id = 1 AND username = $1', [username])).rowCount) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'That username is already taken.' }, { status: 409, headers: privateHeaders });
    }
    const result = await client.query<ManagedUser>('INSERT INTO app_users (id, username, password_hash, session_version) VALUES ($1, $2, $3, $4) RETURNING id, username, password_hash AS "passwordHash", session_version AS "sessionVersion", enabled, created_at AS "createdAt", updated_at AS "updatedAt"', [crypto.randomUUID(), username, passwordDigest(password), crypto.randomUUID()]);
    await client.query('COMMIT');
    return Response.json({ user: publicUser(result.rows[0]), password }, { status: 201, headers: privateHeaders });
  } catch (cause) {
    await client.query('ROLLBACK').catch(() => {});
    if ((cause as { code?: string }).code === '23505') return Response.json({ error: 'That username is already taken.' }, { status: 409, headers: privateHeaders });
    return Response.json({ error: 'Could not create user.' }, { status: 503, headers: privateHeaders });
  } finally { client.release(); }
}
