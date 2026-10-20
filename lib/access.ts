import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto';

export const sessionCookie = 'vanta_session';
const sessionLifetime = 7 * 24 * 60 * 60;
export type Account = 'admin' | 'guest';
export type SessionAccount = Account | 'owner' | `member:${string}`;
export type SessionClaims = { account: SessionAccount; stamp: string };
const memberAccount = /^member:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

function passwordHash(account: Account) {
  return account === 'admin' ? process.env.VANTA_ADMIN_PASSWORD_HASH : process.env.VANTA_GUEST_PASSWORD_HASH;
}

export function hashPassword(password: string, salt: string) {
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

export function checkPassword(account: Account, password: string) {
  return checkPasswordHash(passwordHash(account), password);
}

export function checkPasswordHash(saved: string | undefined, password: string) {
  if (!saved || !/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(saved) || !password || password.length > 256) return false;
  const [salt, expected] = saved.split(':');
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(expected, 'hex'));
}

function sessionSecret() {
  const value = process.env.VANTA_SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

export function sessionStamp(hash: string | undefined) {
  const secret = sessionSecret();
  return hash && secret ? createHmac('sha256', secret).update(hash).digest('hex').slice(0, 16) : null;
}

function signedSession(account: SessionAccount, hash: string | undefined, now: number) {
  const secret = sessionSecret();
  const stamp = sessionStamp(hash);
  if (!secret || !stamp) throw new Error('Authentication is not configured.');
  const payload = Buffer.from(JSON.stringify({ account, exp: Math.floor(now / 1000) + sessionLifetime, stamp })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function createSession(account: Account, now = Date.now()) {
  return signedSession(account, passwordHash(account), now);
}

export function createMemberSession(id: string, credential: string, now = Date.now()) {
  if (!memberAccount.test(`member:${id}`)) throw new Error('Invalid user ID.');
  return signedSession(`member:${id}`, credential, now);
}

export function createOwnerSession(credential: string, now = Date.now()) {
  return signedSession('owner', credential, now);
}

export function readSessionClaims(value: string | undefined, now = Date.now()): SessionClaims | null {
  const secret = sessionSecret();
  if (!secret || !value || value.length > 1024) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const supplied = Buffer.from(signature, 'base64url');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { account?: unknown; exp?: unknown; stamp?: unknown };
    if (typeof decoded.account !== 'string' || typeof decoded.stamp !== 'string' || typeof decoded.exp !== 'number' || decoded.exp <= Math.floor(now / 1000)) return null;
    if (decoded.account === 'admin' || decoded.account === 'guest') return decoded.stamp === sessionStamp(passwordHash(decoded.account)) ? { account: decoded.account, stamp: decoded.stamp } : null;
    return (decoded.account === 'owner' || memberAccount.test(decoded.account)) && /^[a-f0-9]{16}$/.test(decoded.stamp) ? { account: decoded.account as SessionAccount, stamp: decoded.stamp } : null;
  } catch { return null; }
}

export function readSession(value: string | undefined, now = Date.now()): SessionAccount | null {
  return readSessionClaims(value, now)?.account ?? null;
}

export function readRequestSession(request: Request): SessionAccount | null {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${sessionCookie}=`));
  return readSession(cookie?.slice(sessionCookie.length + 1));
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
    if (url.origin !== 'https://vanta.local' || !['/screener', '/bookmarks', '/admin', '/profile'].includes(url.pathname)) return '/screener';
    return `${url.pathname}${url.search}`;
  } catch { return '/screener'; }
}
