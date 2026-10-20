import { NextResponse } from 'next/server';
import { checkPassword, createMemberSession, createOwnerSession, createSession, safeDestination, sameOrigin, sessionCookie } from '@/lib/access';
import { sessionCredential, userByName, verifyUserPassword } from '@/lib/users';
import { ownerCredentials, ownerSessionCredential, verifyOwnerPassword } from '@/lib/owner';

export const runtime = 'nodejs';

const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const attemptWindow = 15 * 60 * 1000;
const maxAttempts = 8;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown').slice(0, 100);
  const now = Date.now();
  if (failedAttempts.size > 10_000) {
    for (const [key, attempt] of failedAttempts) if (attempt.resetAt <= now) failedAttempts.delete(key);
    if (failedAttempts.size > 10_000) failedAttempts.delete(failedAttempts.keys().next().value!);
  }
  const previous = failedAttempts.get(ip);
  if (previous && previous.resetAt > now && previous.count >= maxAttempts) return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(Math.ceil((previous.resetAt - now) / 1000)) } });
  let body: { username?: unknown; password?: unknown; next?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 }); }
  const username = body.username;
  const password = body.password;
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
    failedAttempts.set(ip, { count: (previous && previous.resetAt > now ? previous.count : 0) + 1, resetAt: previous && previous.resetAt > now ? previous.resetAt : now + attemptWindow });
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  failedAttempts.delete(ip);
  const response = NextResponse.json({ next: safeDestination(typeof body.next === 'string' ? body.next : null) });
  response.cookies.set(sessionCookie, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
