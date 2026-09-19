import { env } from "cloudflare:workers";

export async function GET() {
  const result = await env.DB.prepare("SELECT address, created_at AS createdAt FROM bookmarks ORDER BY created_at DESC").all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  const { address } = await request.json() as { address?: string };
  if (!address || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return Response.json({ error: "Invalid address" }, { status: 400 });
  await env.DB.prepare("INSERT OR IGNORE INTO bookmarks (address, created_at) VALUES (?, ?)").bind(address, new Date().toISOString()).run();
  return Response.json({ address }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { address } = await request.json() as { address?: string };
  await env.DB.prepare("DELETE FROM bookmarks WHERE address = ?").bind(address || "").run();
  return Response.json({ ok: true });
}
