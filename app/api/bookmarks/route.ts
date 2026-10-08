import { database } from '@/db/postgres';
import { denyAnonymous } from '@/lib/access';
import { isSolanaAddress } from '@/lib/solana-address';
import { parseCategories, readCategories } from '@/lib/bookmark-categories';

export const runtime = 'nodejs';
type BookmarkRecord = { address: string; name: string; createdAt: Date; categoriesJson: string };
const publicBookmark = (row: BookmarkRecord) => ({ address: row.address, name: row.name, createdAt: row.createdAt.toISOString(), categories: readCategories(row.categoriesJson) });
const selectRow = 'SELECT address, name, created_at AS "createdAt", categories_json AS "categoriesJson" FROM bookmarks';

export async function GET(request: Request) {
  const denied = denyAnonymous(request); if (denied) return denied;
  try {
    const result = await database().query<BookmarkRecord>(`${selectRow} ORDER BY created_at DESC`);
    return Response.json(result.rows.map(publicBookmark), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Could not load bookmarks.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const denied = denyAnonymous(request); if (denied) return denied;
  let address: unknown;
  try { ({ address } = await request.json() as { address?: unknown }); } catch { return Response.json({ error: 'Enter a Solana wallet address.' }, { status: 400 }); }
  if (typeof address !== 'string' || !isSolanaAddress(address)) return Response.json({ error: 'Enter a valid Solana wallet address.' }, { status: 400 });
  try {
    const result = await database().query('INSERT INTO bookmarks (address, created_at) VALUES ($1, $2) ON CONFLICT (address) DO NOTHING RETURNING address', [address, new Date().toISOString()]);
    const row = await database().query<BookmarkRecord>(`${selectRow} WHERE address = $1`, [address]);
    const created = result.rowCount === 1;
    return Response.json({ ...publicBookmark(row.rows[0]), created }, { status: created ? 201 : 200 });
  } catch { return Response.json({ error: 'Could not save the wallet. Please retry.' }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  const denied = denyAnonymous(request); if (denied) return denied;
  try {
    const { address } = await request.json() as { address?: string };
    if (!address || !isSolanaAddress(address)) return Response.json({ error: 'Enter a valid Solana wallet address.' }, { status: 400 });
    await database().query('DELETE FROM bookmarks WHERE address = $1', [address]);
    return Response.json({ ok: true });
  } catch { return Response.json({ error: 'Could not remove the bookmark.' }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  const denied = denyAnonymous(request); if (denied) return denied;
  let body: { address?: unknown; name?: unknown; categories?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
  if (!body || typeof body.address !== 'string' || !isSolanaAddress(body.address)) return Response.json({ error: 'Enter a valid Solana wallet address.' }, { status: 400 });
  if ('categories' in body) {
    const categories = parseCategories(body.categories);
    if (!categories) return Response.json({ error: 'Choose valid wallet categories.' }, { status: 400 });
    try {
      const result = await database().query('UPDATE bookmarks SET categories_json = $1 WHERE address = $2', [JSON.stringify(categories), body.address]);
      if (!result.rowCount) return Response.json({ error: 'This wallet is no longer bookmarked.' }, { status: 404 });
      return Response.json({ address: body.address, categories });
    } catch { return Response.json({ error: 'Could not save wallet categories. Please retry.' }, { status: 503 }); }
  }
  if (typeof body.name !== 'string' || body.name.trim().length > 80) return Response.json({ error: 'Enter a name of up to 80 characters.' }, { status: 400 });
  const name = body.name.trim();
  try {
    const result = await database().query('UPDATE bookmarks SET name = $1 WHERE address = $2', [name, body.address]);
    if (!result.rowCount) return Response.json({ error: 'This wallet is no longer bookmarked.' }, { status: 404 });
    return Response.json({ address: body.address, name });
  } catch { return Response.json({ error: 'Could not save the wallet name. Please retry.' }, { status: 503 }); }
}
