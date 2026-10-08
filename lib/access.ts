import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const sessionCookie = 'vanta_session';
const sessionLifetime = 7 * 24 * 60 * 60;
export type Account = 'admin' | 'guest';

function passwordHash(account: Account) {
  return account === 'admin' ? process.env.VANTA_ADMIN_PASSWORD_HASH : process.env.VANTA_GUEST_PASSWORD_HASH;
}

export function hashPassword(password: string, salt: string) {
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

export function checkPassword(account: Account, password: string) {
  const saved = passwordHash(account);
  if (!saved || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(saved) || password.length > 256) return false;
  const [salt, expected] = saved.split(':');
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(expected, 'hex'));
}

function sessionSecret() {
  const value = process.env.VANTA_SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

function sessionStamp(account: Account) {
  const hash = passwordHash(account);
  const secret = sessionSecret();
  return hash && secret ? createHmac('sha256', secret).update(hash).digest('hex').slice(0, 16) : null;
}

export function createSession(account: Account, now = Date.now()) {
  const secret = sessionSecret();
  const stamp = sessionStamp(account);
  if (!secret || !stamp) throw new Error('Authentication is not configured.');
  const payload = Buffer.from(JSON.stringify({ account, exp: Math.floor(now / 1000) + sessionLifetime, stamp })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readSession(value: string | undefined, now = Date.now()): Account | null {
  const secret = sessionSecret();
  if (!secret || !value || value.length > 512) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { account?: unknown; exp?: unknown; stamp?: unknown };
    if ((decoded.account !== 'admin' && decoded.account !== 'guest') || typeof decoded.exp !== 'number' || decoded.exp <= Math.floor(now / 1000)) return null;
    return decoded.stamp === sessionStamp(decoded.account) ? decoded.account : null;
  } catch { return null; }
}

export function readRequestSession(request: Request): Account | null {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`));
  return readSession(cookie?.slice(sessionCookie.length + 1));
}

export function denyAnonymous(request: Request): Response | null {
  if (!readRequestSession(request)) return Response.json({ error: 'Sign in to continue.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  return null;
}

export function sameOrigin(request: Request) {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get('host'); }
  catch { return false; }
}

export function safeDestination(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/screener';
  try {
    const url = new URL(value, 'https://vanta.local');
    if (url.origin !== 'https://vanta.local' || !['/screener', '/bookmarks'].includes(url.pathname)) return '/screener';
    return `${url.pathname}${url.search}`;
  } catch { return '/screener'; }
}
