import { NextResponse } from 'next/server';
import { createOwnerSession, sameOrigin, sessionCookie } from '@/lib/access';
import { authenticateRequest } from '@/lib/authorize';
import { ownerSessionCredential, updateOwnerCredentials } from '@/lib/owner';
import { validPassword } from '@/lib/users';

export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  const identity = await authenticateRequest(request);
  if (!identity) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (!identity.isAdmin) return NextResponse.json({ error: 'Only the admin can change profile credentials.' }, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  let body: { username?: unknown; currentPassword?: unknown; newPassword?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: 'Enter your account details.' }, { status: 400 }); }
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword === '' || body.newPassword == null ? null : body.newPassword;
  if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username)) return NextResponse.json({ error: 'Username must be 3–32 lowercase letters, numbers, underscores, or hyphens.' }, { status: 400 });
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 256) return NextResponse.json({ error: 'Enter your current password.' }, { status: 400 });
  if (newPassword !== null && (typeof newPassword !== 'string' || !validPassword(newPassword))) return NextResponse.json({ error: 'New password must be 12–256 characters.' }, { status: 400 });
  if (username === identity.username && newPassword === null) return NextResponse.json({ error: 'Enter a new username or password.' }, { status: 400 });
  try {
    const owner = await updateOwnerCredentials(currentPassword, username, newPassword);
    const response = NextResponse.json({ username: owner.username, message: 'Profile updated. Other admin sessions were signed out.' });
    response.cookies.set(sessionCookie, createOwnerSession(ownerSessionCredential(owner)), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const message = (error as Error).message;
    if (message === 'Current password is incorrect.' || message === 'That username is already in use.') return NextResponse.json({ error: message }, { status: message === 'Current password is incorrect.' ? 401 : 409 });
    return NextResponse.json({ error: 'Could not update the profile. Try again.' }, { status: 503 });
  }
}
