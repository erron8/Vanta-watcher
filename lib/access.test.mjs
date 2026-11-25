import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, checkPassword, createMemberSession, createOwnerSession, createSession, readSession, readSessionClaims, sameOrigin, safeDestination, sessionStamp } from './access.ts';

const adminHash = hashPassword('admin-test-password', '0123456789abcdef0123456789abcdef');
const guestHash = hashPassword('guest-test-password', 'fedcba9876543210fedcba9876543210');
process.env.VANTA_ADMIN_PASSWORD_HASH = adminHash;
process.env.VANTA_GUEST_PASSWORD_HASH = guestHash;
process.env.VANTA_SESSION_SECRET = 'test-secret-that-is-longer-than-32-characters';

test('credentials and signed sessions reject tampering, expiry, and password rotation', () => {
  assert.equal(checkPassword('admin', 'admin-test-password'), true);
  assert.equal(checkPassword('admin', 'wrong'), false);
  assert.equal(checkPassword('guest', 'guest-test-password'), true);
  const now = Date.UTC(2026, 9, 8);
  const token = createSession('admin', now);
  assert.notEqual(token, createSession('admin', now), 'sessions created in the same second must be independently revocable');
  assert.equal(readSession(token, now), 'admin');
  assert.equal(readSession(token + 'x', now), null);
  assert.equal(readSession(token, now + 8 * 24 * 60 * 60 * 1000), null);
  process.env.VANTA_ADMIN_PASSWORD_HASH = hashPassword('new-password', '11111111111111111111111111111111');
  assert.equal(readSession(token, now), null);
  process.env.VANTA_ADMIN_PASSWORD_HASH = adminHash;
});

test('redirects stay on protected app routes', () => {
  assert.equal(safeDestination('/bookmarks?filter=all'), '/bookmarks?filter=all');
  assert.equal(safeDestination('/admin'), '/admin');
  assert.equal(safeDestination('/profile'), '/profile');
  assert.equal(safeDestination('//other.example'), '/screener');
  assert.equal(safeDestination('/api/scans'), '/screener');
});

test('owner sessions are signed and change stamp when credentials rotate', () => {
  const now = Date.UTC(2026, 9, 20);
  const token = createOwnerSession('owner-hash:first-version', now);
  assert.equal(readSession(token, now), 'owner');
  assert.equal(readSessionClaims(token, now)?.stamp, sessionStamp('owner-hash:first-version'));
  assert.notEqual(readSessionClaims(token, now)?.stamp, sessionStamp('owner-hash:second-version'));
  assert.equal(readSession(token + 'x', now), null);
  assert.equal(readSession(token, now + 8 * 24 * 60 * 60 * 1000), null);
});

test('managed user sessions are signed and stamped to revoke on account changes', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  const credential = `${hashPassword('friend-password-123', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')}:version-one`;
  const now = Date.UTC(2026, 9, 20);
  const token = createMemberSession(id, credential, now);
  assert.equal(readSession(token, now), `member:${id}`);
  assert.equal(readSessionClaims(token, now)?.stamp, sessionStamp(credential));
  assert.notEqual(readSessionClaims(token, now)?.stamp, sessionStamp(`${credential}:version-two`));
  assert.equal(readSession(token + 'x', now), null);
  assert.equal(readSession(token, now + 8 * 24 * 60 * 60 * 1000), null);
});

test('browser writes require a matching trusted origin or a same-origin referer', () => {
  const target = 'https://vanta.example.com';
  process.env.VANTA_PUBLIC_ORIGIN = target;
  const check = (headers, method = 'POST') => sameOrigin(new Request(target + '/api/profile', {
    method, headers: { host: 'vanta.example.com', ...headers },
  }));
  try {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      assert.equal(check({}, method), false);
      assert.equal(check({ origin: target }, method), true);
    }
    assert.equal(check({ referer: target + '/admin' }), true);
    assert.equal(check({ origin: target, host: 'vanta.example.com:443' }), true);
    for (const origin of ['null', 'invalid', 'http://vanta.example.com', target + ':3000', target + '/admin', 'https://other.example']) {
      assert.equal(check({ origin, referer: target }), false);
    }
    assert.equal(check({ referer: 'https://other.example/admin' }), false);
    assert.equal(check({ origin: target, host: 'different.example' }), false);
    for (const method of ['GET', 'HEAD']) assert.equal(check({}, method), true);
  } finally { delete process.env.VANTA_PUBLIC_ORIGIN; }
});

test('Vercel accepts writes only for an authorized domain serving this request', () => {
  process.env.VERCEL = '1';
  process.env.VERCEL_URL = 'preview.example';
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'live.example';
  process.env.VERCEL_ENV = 'preview';
  const check = host => sameOrigin(new Request('http://localhost/api/waitlist', {
    method: 'POST', headers: { host, origin: 'https://' + host },
  }));
  try {
    assert.equal(check('preview.example'), true);
    assert.equal(check('live.example'), false);
    process.env.VERCEL_ENV = 'production';
    assert.equal(check('live.example'), true);
    assert.equal(check('unconfigured.example'), false);
  } finally {
    for (const key of ['VERCEL', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_ENV']) delete process.env[key];
  }
});
