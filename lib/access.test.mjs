import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, checkPassword, createMemberSession, createSession, readSession, readSessionClaims, sameOrigin, safeDestination, sessionStamp } from './access.ts';

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
  assert.equal(readSession(token, now), 'admin');
  assert.equal(readSession(token + 'x', now), null);
  assert.equal(readSession(token, now + 8 * 24 * 60 * 60 * 1000), null);
  process.env.VANTA_ADMIN_PASSWORD_HASH = hashPassword('new-password', '11111111111111111111111111111111');
  assert.equal(readSession(token, now), null);
  process.env.VANTA_ADMIN_PASSWORD_HASH = adminHash;
});

test('redirects stay on protected app routes and cross-origin writes are rejected', () => {
  assert.equal(safeDestination('/bookmarks?filter=all'), '/bookmarks?filter=all');
  assert.equal(safeDestination('/admin'), '/admin');
  assert.equal(safeDestination('//other.example'), '/screener');
  assert.equal(safeDestination('/api/scans'), '/screener');
  assert.equal(sameOrigin(new Request('https://vanta.example.com/api/bookmarks', { method: 'POST', headers: { host: 'vanta.example.com', origin: 'https://evil.example.com' } })), false);
  assert.equal(sameOrigin(new Request('https://vanta.example.com/api/bookmarks', { method: 'POST', headers: { host: 'vanta.example.com', origin: 'https://vanta.example.com' } })), true);
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
