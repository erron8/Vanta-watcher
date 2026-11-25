import assert from 'node:assert/strict';
import test from 'node:test';
import { clientIp } from './client-ip.ts';

test('rate limits use only the address assigned by the configured ingress', () => {
  const resolve = headers => clientIp(new Request('https://app.example', { headers }));
  const peer = { 'x-vanta-client-ip': '203.0.113.8', 'x-vercel-forwarded-for': '2001:0DB8:0:0::1' };
  delete process.env.VERCEL;
  delete process.env.VANTA_TRUST_CADDY;
  assert.equal(resolve(peer), 'unknown');
  process.env.VANTA_TRUST_CADDY = '1';
  assert.equal(resolve(peer), '203.0.113.8');
  assert.equal(resolve({ ...peer, 'x-forwarded-for': '203.0.113.9' }), '203.0.113.8');
  assert.equal(resolve({ 'x-vanta-client-ip': '203.0.113.9' }), '203.0.113.9');
  process.env.VERCEL = '1';
  assert.equal(resolve(peer), '2001:db8::1');
  for (const value of ['', 'invalid', '203.0.113.1, 203.0.113.2', '::1%zone']) {
    assert.equal(resolve({ ...peer, 'x-vercel-forwarded-for': value }), 'unknown');
  }
  assert.equal(resolve({ 'x-vanta-client-ip': '203.0.113.8' }), 'unknown');
});
