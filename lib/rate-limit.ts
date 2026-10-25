import { database } from '@/db/postgres';
import { authenticateRequest } from './authorize';

// The unique key and conditional update make a limit atomic across Vercel instances.
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const expiresAt = new Date((bucket + 1) * windowSeconds * 1000);
  const result = await database().query(`INSERT INTO rate_limits (key, bucket, count, expires_at) VALUES ($1, $2, 1, $3)
    ON CONFLICT (key, bucket) DO UPDATE SET count = rate_limits.count + 1
    WHERE rate_limits.count < $4 RETURNING count`, [key, bucket, expiresAt, limit]);
  // Expired buckets are disposable; amortize cleanup instead of doing it on every request.
  if (Math.random() < 0.01) await database().query('DELETE FROM rate_limits WHERE expires_at < now()').catch(() => {});
  return !!result.rowCount;
}

export function rateLimited(retryAfterSeconds = 60) {
  return Response.json({ error: 'Too many requests. Please try again later.' }, {
    status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfterSeconds) },
  });
}

export function serviceUnavailable() {
  return Response.json({ error: 'Request limit service unavailable. Please retry.' }, {
    status: 503, headers: { 'Cache-Control': 'no-store' },
  });
}

export async function enforceRateLimit(account: string, scope: string, limit: number, windowSeconds: number): Promise<Response | null> {
  try { return await consumeRateLimit(`${scope}:${account}`, limit, windowSeconds) ? null : rateLimited(windowSeconds); }
  catch { return serviceUnavailable(); }
}

export async function denyUpstream(request: Request): Promise<Response | null> {
  const identity = await authenticateRequest(request);
  if (!identity) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return enforceRateLimit(identity.account, 'upstream', 3000, 24 * 3600);
}
