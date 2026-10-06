import { env } from "cloudflare:workers";
import { isSolanaAddress } from "@/lib/solana-address";

export async function GET() {
  if (!env.DB) return Response.json({ error: "Database unavailable" }, { status: 503 });
  const result = await env.DB.prepare("SELECT address, name, created_at AS createdAt FROM bookmarks ORDER BY created_at DESC").all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "Database unavailable" }, { status: 503 });
  let address: unknown;
  try { ({ address } = await request.json() as { address?: unknown }); } catch { return Response.json({ error: "Enter a Solana wallet address." }, { status: 400 }); }
  if (typeof address !== "string" || !isSolanaAddress(address)) return Response.json({ error: "Enter a valid Solana wallet address." }, { status: 400 });
  try {
    const createdAt = new Date().toISOString();
    const result = await env.DB.prepare("INSERT OR IGNORE INTO bookmarks (address, created_at) VALUES (?, ?)").bind(address, createdAt).run();
    const row = await env.DB.prepare("SELECT address, name, created_at AS createdAt FROM bookmarks WHERE address = ?").bind(address).first();
    return Response.json({ ...row, created: result.meta.changes > 0 }, { status: result.meta.changes > 0 ? 201 : 200 });
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
  let body: { address?: unknown; name?: unknown };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  if (!body || typeof body.address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.address) || typeof body.name !== "string" || body.name.trim().length > 80) return Response.json({ error: "Enter a name of up to 80 characters." }, { status: 400 });
  const name = body.name.trim();
  try {
    const result = await env.DB.prepare("UPDATE bookmarks SET name = ? WHERE address = ?").bind(name, body.address).run();
    if (!result.meta.changes) return Response.json({ error: "This wallet is no longer bookmarked." }, { status: 404 });
    return Response.json({ address: body.address, name });
  } catch { return Response.json({ error: "Could not save the wallet name. Please retry." }, { status: 503 }); }
}
