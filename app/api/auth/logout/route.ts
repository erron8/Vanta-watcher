import { NextResponse } from 'next/server';
import { readSessionClaims, sameOrigin, sessionCookie } from '@/lib/access';
import { revokeSession } from '@/lib/session-revocation';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`));
  const token = cookie?.slice(sessionCookie.length + 1);
  if (token && readSessionClaims(token)) {
    try { await revokeSession(token); }
    catch { return NextResponse.json({ error: 'Could not sign out. Please retry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
