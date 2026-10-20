import { database } from '@/db/postgres';
import { denyNonAdmin } from '@/lib/authorize';
import { passwordDigest, publicUser, userById, validPassword, validUsername, type ManagedUser } from '@/lib/users';

export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
const isId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const denied = await denyNonAdmin(request); if (denied) return denied;
  const { id } = await context.params;
  if (!isId(id)) return Response.json({ error: 'Invalid user.' }, { status: 400, headers: privateHeaders });
  let body: { username?: unknown; password?: unknown; enabled?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: 'Invalid changes.' }, { status: 400, headers: privateHeaders }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Invalid changes.' }, { status: 400, headers: privateHeaders });
  if (body.username === undefined && body.password === undefined && body.enabled === undefined) return Response.json({ error: 'No changes provided.' }, { status: 400, headers: privateHeaders });
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : undefined;
  if (body.username !== undefined && (!username || !validUsername(username))) return Response.json({ error: 'Use 3–32 lowercase letters, numbers, underscores, or hyphens. Start with a letter.' }, { status: 400, headers: privateHeaders });
  if (body.password !== undefined && (typeof body.password !== 'string' || !validPassword(body.password))) return Response.json({ error: 'Password must be 12–256 characters.' }, { status: 400, headers: privateHeaders });
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') return Response.json({ error: 'Invalid account status.' }, { status: 400, headers: privateHeaders });
  try {
    const user = await userById(id);
    if (!user) return Response.json({ error: 'User not found.' }, { status: 404, headers: privateHeaders });
    const result = await database().query<ManagedUser>('UPDATE app_users SET username = $2, password_hash = $3, enabled = $4, session_version = $5, updated_at = now() WHERE id = $1 RETURNING id, username, password_hash AS "passwordHash", session_version AS "sessionVersion", enabled, created_at AS "createdAt", updated_at AS "updatedAt"', [id, username ?? user.username, typeof body.password === 'string' ? passwordDigest(body.password) : user.passwordHash, body.enabled ?? user.enabled, crypto.randomUUID()]);
    if (!result.rows[0]) return Response.json({ error: 'User not found.' }, { status: 404, headers: privateHeaders });
    return Response.json({ user: publicUser(result.rows[0]) }, { headers: privateHeaders });
  } catch (cause) {
    if ((cause as { code?: string }).code === '23505') return Response.json({ error: 'That username is already taken.' }, { status: 409, headers: privateHeaders });
    return Response.json({ error: 'Could not update user.' }, { status: 503, headers: privateHeaders });
  }
}

export async function DELETE(request: Request, context: Context) {
  const denied = await denyNonAdmin(request); if (denied) return denied;
  const { id } = await context.params;
  if (!isId(id)) return Response.json({ error: 'Invalid user.' }, { status: 400, headers: privateHeaders });
  try {
    const result = await database().query('DELETE FROM app_users WHERE id = $1', [id]);
    if (!result.rowCount) return Response.json({ error: 'User not found.' }, { status: 404, headers: privateHeaders });
    return Response.json({ deleted: true }, { headers: privateHeaders });
  } catch { return Response.json({ error: 'Could not delete user.' }, { status: 503, headers: privateHeaders }); }
}
