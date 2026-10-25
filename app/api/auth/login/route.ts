import { NextResponse } from 'next/server';
import { checkPassword, createMemberSession, createOwnerSession, createSession, safeDestination, sameOrigin, sessionCookie } from '@/lib/access';
import { sessionCredential, userByName, verifyUserPassword } from '@/lib/users';
import { ownerCredentials, ownerSessionCredential, verifyOwnerPassword } from '@/lib/owner';
import { createHmac } from 'node:crypto';
import { consumeRateLimit, rateLimited, serviceUnavailable } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const attemptWindow = 15 * 60 * 1000;
const maxAttempts = 8;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  let body: { username?: unknown; password?: unknown; next?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
  const username = body.username;
  const password = body.password;
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 100);
  const secret = process.env.VANTA_SESSION_SECRET;
  if (!secret) return NextResponse.json({ error: 'Sign-in is temporarily unavailable.' }, { status: 503 });
  const hash = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
  try {
    // Reserve both slots before the first awaited password or database lookup.
    if (!await consumeRateLimit(`login-ip:${hash(ip)}`, 60, attemptWindow / 1000)
      || typeof username === 'string' && !await consumeRateLimit(`login-user:${hash(username.trim().toLowerCase())}`, maxAttempts, attemptWindow / 1000)) return rateLimited(attemptWindow / 1000);
  } catch { return serviceUnavailable(); }
  let valid = false;
  let token: string | undefined;
  if (typeof username === 'string' && typeof password === 'string' && password.length <= 256) {
    try {
      if (username === 'guest') {
        valid = checkPassword('guest', password);
        if (valid) token = createSession('guest');
      } else if (/^[a-z][a-z0-9_-]{2,31}$/.test(username)) {
        const owner = await ownerCredentials();
        if (owner ? username === owner.username : username === 'admin') {
          valid = verifyOwnerPassword(owner, password);
          if (valid) token = owner ? createOwnerSession(ownerSessionCredential(owner)) : createSession('admin');
        } else if (username !== 'admin') {
          const user = await userByName(username);
          valid = !!user && verifyUserPassword(user, password);
          if (valid && user) token = createMemberSession(user.id, sessionCredential(user));
        }
      }
    } catch { return NextResponse.json({ error: 'Sign-in is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  }
  if (!valid || !token) {
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const response = NextResponse.json({ next: safeDestination(typeof body.next === 'string' ? body.next : null) });
  response.cookies.set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
