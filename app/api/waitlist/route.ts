import { createHmac } from 'node:crypto';
import { database } from '@/db/postgres';
import { sameOrigin } from '@/lib/access';
import { consumeRateLimit, rateLimited, serviceUnavailable } from '@/lib/rate-limit';
import { normalizeTelegramHandle } from '@/lib/waitlist';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: noStore });

  const secret = process.env.VANTA_SESSION_SECRET;
  if (!secret) return serviceUnavailable();
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 100);
  const ipKey = createHmac('sha256', secret).update(ip).digest('hex');
  try {
    if (!await consumeRateLimit(`waitlist-ip:${ipKey}`, 10, 24 * 3600)) return rateLimited(24 * 3600);
  } catch { return serviceUnavailable(); }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 512) return Response.json({ error: 'Enter a Telegram handle.' }, { status: 400, headers: noStore });
    body = JSON.parse(raw);
  } catch { return Response.json({ error: 'Enter a Telegram handle.' }, { status: 400, headers: noStore }); }
  const handle = normalizeTelegramHandle(body && typeof body === 'object' && !Array.isArray(body) ? (body as { telegramHandle?: unknown }).telegramHandle : null);
  if (!handle) return Response.json({ error: 'Enter a valid Telegram username (5–32 letters, numbers, or underscores).' }, { status: 400, headers: noStore });

  try {
    await database().query('INSERT INTO waitlist (id, telegram_handle) VALUES ($1, $2) ON CONFLICT (telegram_handle) DO NOTHING', [crypto.randomUUID(), handle]);
    return Response.json({ ok: true }, { status: 201, headers: noStore });
  } catch { return Response.json({ error: 'Could not join the waitlist right now. Please try again.' }, { status: 503, headers: noStore }); }
}
