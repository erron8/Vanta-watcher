import { env } from "cloudflare:workers";
import { isSolanaAddress } from "@/lib/solana-address";
import { parseCategories, readCategories } from "@/lib/bookmark-categories";

type BookmarkRecord = { address: string; name: string; createdAt: string; categoriesJson: string };
const publicBookmark = (row: BookmarkRecord) => ({ address: row.address, name: row.name, createdAt: row.createdAt, categories: readCategories(row.categoriesJson) });

export async function GET() {
  if (!env.DB) return Response.json({ error: "Database unavailable" }, { status: 503 });
  const result = await env.DB.prepare("SELECT address, name, created_at AS createdAt, categories_json AS categoriesJson FROM bookmarks ORDER BY created_at DESC").all<BookmarkRecord>();
  return Response.json(result.results.map(publicBookmark));
}

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "Database unavailable" }, { status: 503 });
  let address: unknown;
  try { ({ address } = await request.json() as { address?: unknown }); } catch { return Response.json({ error: "Enter a Solana wallet address." }, { status: 400 }); }
  if (typeof address !== "string" || !isSolanaAddress(address)) return Response.json({ error: "Enter a valid Solana wallet address." }, { status: 400 });
  try {
    const createdAt = new Date().toISOString();
    const result = await env.DB.prepare("INSERT OR IGNORE INTO bookmarks (address, created_at) VALUES (?, ?)").bind(address, createdAt).run();
    const row = await env.DB.prepare("SELECT address, name, created_at AS createdAt, categories_json AS categoriesJson FROM bookmarks WHERE address = ?").bind(address).first<BookmarkRecord>();
    return Response.json({ ...publicBookmark(row!), created: result.meta.changes > 0 }, { status: result.meta.changes > 0 ? 201 : 200 });
  } catch { return Response.json({ error: "Could not save the wallet. Please retry." }, { status: 503 }); }
}

export async function DELETE(request: Request) {
  if (!env.DB) return Response.json({ error: "Database unavailable" }, { status: 503 });
  const { address } = await request.json() as { address?: string };
  await env.DB.prepare("DELETE FROM bookmarks WHERE address = ?").bind(address || "").run();
  return Response.json({ ok: true });
}

export async function PATCH(request: Request) {
  if (!env.DB) return Response.json({ error: "Database unavailable" }, { status: 503 });
  let body: { address?: unknown; name?: unknown; categories?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body.address !== "string" || !isSolanaAddress(body.address)) return Response.json({ error: "Enter a valid Solana wallet address." }, { status: 400 });
  if ('categories' in body) {
    const categories = parseCategories(body.categories);
    if (!categories) return Response.json({ error: "Choose valid wallet categories." }, { status: 400 });
    try {
      const result = await env.DB.prepare("UPDATE bookmarks SET categories_json = ? WHERE address = ?").bind(JSON.stringify(categories), body.address).run();
      if (!result.meta.changes) return Response.json({ error: "This wallet is no longer bookmarked." }, { status: 404 });
      return Response.json({ address: body.address, categories });
    } catch { return Response.json({ error: "Could not save wallet categories. Please retry." }, { status: 503 }); }
  }
  if (typeof body.name !== "string" || body.name.trim().length > 80) return Response.json({ error: "Enter a name of up to 80 characters." }, { status: 400 });
  const name = body.name.trim();
  try {
    const result = await env.DB.prepare("UPDATE bookmarks SET name = ? WHERE address = ?").bind(name, body.address).run();
    if (!result.meta.changes) return Response.json({ error: "This wallet is no longer bookmarked." }, { status: 404 });
    return Response.json({ address: body.address, name });
  } catch { return Response.json({ error: "Could not save the wallet name. Please retry." }, { status: 503 }); }
}
