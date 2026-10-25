import { database } from '@/db/postgres';
import { denyNonAdmin } from '@/lib/authorize';

export const runtime = 'nodejs';
const privateHeaders = { 'Cache-Control': 'private, no-store' };
type Entry = { id: string; telegramHandle: string; done: boolean; createdAt: string; updatedAt: string };

export async function GET(request: Request) {
  const denied = await denyNonAdmin(request); if (denied) return denied;
  try {
    const result = await database().query<Entry>('SELECT id, telegram_handle AS "telegramHandle", done, created_at AS "createdAt", updated_at AS "updatedAt" FROM waitlist ORDER BY done, created_at DESC');
    return Response.json({ entries: result.rows }, { headers: privateHeaders });
  } catch { return Response.json({ error: 'Could not load waitlist.' }, { status: 503, headers: privateHeaders }); }
}

export async function PATCH(request: Request) {
  const denied = await denyNonAdmin(request); if (denied) return denied;
  let body: { id?: unknown; done?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return Response.json({ error: 'Invalid waitlist update.' }, { status: 400, headers: privateHeaders }); }
  if (!body || typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || typeof body.done !== 'boolean') {
    return Response.json({ error: 'Invalid waitlist update.' }, { status: 400, headers: privateHeaders });
  }
  try {
    const result = await database().query<Entry>('UPDATE waitlist SET done = $2, updated_at = now() WHERE id = $1 RETURNING id, telegram_handle AS "telegramHandle", done, created_at AS "createdAt", updated_at AS "updatedAt"', [body.id, body.done]);
    if (!result.rows[0]) return Response.json({ error: 'Waitlist entry not found.' }, { status: 404, headers: privateHeaders });
    return Response.json({ entry: result.rows[0] }, { headers: privateHeaders });
  } catch { return Response.json({ error: 'Could not update waitlist.' }, { status: 503, headers: privateHeaders }); }
}
