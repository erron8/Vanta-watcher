import { readSessionClaims, sameOrigin, sessionCookie, sessionStamp } from './access';
import { sessionCredential, userById } from './users';
import { ownerCredentials, ownerSessionCredential } from './owner';

export type Identity = { account: string; username: string; isAdmin: boolean };

export async function authenticateSession(cookie: string | undefined): Promise<Identity | null> {
  const claims = readSessionClaims(cookie);
  if (!claims) return null;
  try {
    if (claims.account === 'guest') return { account: 'guest', username: 'guest', isAdmin: false };
    if (claims.account === 'admin' || claims.account === 'owner') {
      const owner = await ownerCredentials();
      if (claims.account === 'admin') return owner ? null : { account: 'admin', username: 'admin', isAdmin: true };
      if (!owner || claims.stamp !== sessionStamp(ownerSessionCredential(owner))) return null;
      return { account: 'admin', username: owner.username, isAdmin: true };
    }
    const user = await userById(claims.account.slice('member:'.length));
    if (!user?.enabled || claims.stamp !== sessionStamp(sessionCredential(user))) return null;
    return { account: claims.account, username: user.username, isAdmin: false };
  } catch { return null; }
}

export async function authenticateRequest(request: Request): Promise<Identity | null> {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`));
  return authenticateSession(cookie?.slice(sessionCookie.length + 1));
}

export async function denyAnonymous(request: Request): Promise<Response | null> {
  if (!await authenticateRequest(request)) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  return null;
}

export async function denyNonAdmin(request: Request): Promise<Response | null> {
  const identity = await authenticateRequest(request);
  if (!identity) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  if (!identity.isAdmin || !sameOrigin(request)) return Response.json({ error: 'Admin access required.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  return null;
}
