import assert from 'node:assert/strict';
import { test } from 'node:test';
import { history, matches, duration } from './history.ts';
import { historyUrl } from './history-url.ts';

const pool = { poolAddress: 'pool1', tokenX: 'BIDDY', tokenY: 'SOL', lastClosedAt: 1789862400 };
const position = { positionAddress: 'position1', createdAt: 1789859765, closedAt: 1789861200, pnlUsd: '203', allTimeDeposits: { total: { usd: '567' } } };

test('matches individual deposits, signed P&L, and holding duration with inclusive tolerances', () => {
  const target = { tvl: 567, tolerance: 10, pnl: 203, pnlTolerance: 2, seconds: 1435, secondsTolerance: 60 };
  assert.equal(matches(position, target), true);
  assert.equal(matches({ ...position, pnlUsd: '-203' }, target), false);
  assert.equal(matches(position, { ...target, tvl: 578 }), false);
  assert.equal(matches(position, { ...target, seconds: 1495 }), true);
  assert.equal(matches(position, { ...target, seconds: 1496 }), false);
  assert.equal(duration(1435), '00:23:55');
});

test('loads all portfolio and position pages only when invoked, filters UTC close date, and reuses pages', async () => {
  const original = globalThis.fetch; const calls = [];
  globalThis.fetch = async url => {
    calls.push(url); const q = new URL(url, 'http://localhost').searchParams;
    if (!new URL(url, 'http://localhost').pathname.includes('/positions/')) return Response.json(q.get('page') === '1' ? { pools: [pool], hasNext: true } : { pools: [{ ...pool, poolAddress: 'pool2', tokenX: 'OTHER' }], hasNext: false });
    return Response.json(q.get('page') === '1' ? { positions: [position], hasNext: true } : { positions: [{ ...position, positionAddress: 'position2', closedAt: 1789947600 }, position], hasNext: false });
  };
  try {
    assert.equal(calls.length, 0);
    const found = []; const options = { pair: 'BIDDY-SOL', date: new Date(position.closedAt * 1000).toISOString().slice(0, 10) };
    await history('test-wallet', new AbortController().signal, p => found.push(p), options);
    assert.equal(calls.length, 4); assert.equal(found.length, 1); assert.equal(found[0].pool.poolAddress, 'pool1');
    await history('test-wallet', new AbortController().signal, () => {}, options);
    assert.equal(calls.length, 4);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(history('test-wallet', abort.signal, () => {}, options), { name: 'AbortError' });
    assert.equal(calls.length, 4);
  } finally { globalThis.fetch = original; }
});

test('loads known portfolio pages concurrently and falls back to the proxy when direct access fails', async () => {
  const original = globalThis.fetch;
  const pages = [], calls = []; let active = 0, peak = 0;
  globalThis.fetch = async url => {
    calls.push(String(url));
    if (String(url).startsWith('https://')) throw new TypeError('Blocked by browser network');
    const page = Number(new URL(url, 'http://localhost').searchParams.get('page'));
    if (page === 1) return Response.json({ pools: [pool], hasNext: true, totalCount: 4, pageSize: 1 });
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 12));
    active--; pages.push(page);
    return Response.json({ pools: [{ ...pool, poolAddress: `pool-${page}`, tokenX: 'OTHER' }], hasNext: page < 4 });
  };
  try {
    await history('fallback-wallet', new AbortController().signal, () => {}, { pair: 'NO-MATCH' });
    assert.equal(peak, 3);
    assert.deepEqual(pages.sort(), [2, 3, 4]);
    assert.equal(calls.filter(url => url.startsWith('/api/history?')).length, 4);
  } finally { globalThis.fetch = original; }
});

test('rejects incomplete pagination instead of reporting a complete search', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ pools: [], hasNext: true });
  try { await assert.rejects(history('broken-wallet', new AbortController().signal, () => {}), /Incomplete pool pagination/); }
  finally { globalThis.fetch = original; }
});

test('finds a match on the last position page of the last pool page across direct and proxy requests', async () => {
  const original = globalThis.fetch;
  const calls = [];
  const otherPools = Array.from({ length: 100 }, (_, i) => ({ ...pool, poolAddress: `other-${i}`, tokenX: 'OTHER' }));
  const otherPositions = Array.from({ length: 100 }, (_, i) => ({ ...position, positionAddress: `other-position-${i}`, pnlUsd: '0' }));
  globalThis.fetch = async url => {
    const { pathname, searchParams } = new URL(url, 'https://test.invalid');
    assert.equal(searchParams.get('page_size'), '100');
    const page = Number(searchParams.get('page'));
    const isProxy = pathname === '/api/history';
    const isPool = pathname === '/portfolio' || (isProxy && !searchParams.has('pool'));
    calls.push([isPool, page, isProxy]);
    if (page === 2 && !isProxy) return new Response(null, { status: 403 });
    const records = isPool ? { pools: page === 1 ? otherPools : [pool] } : { positions: page === 1 ? otherPositions : [position] };
    return Response.json({ ...records, pageSize: 100, totalCount: 101, hasNext: page === 1 });
  };
  try {
    const hits = [];
    await history('boundary-wallet', new AbortController().signal, p => {
      if (matches(p, { tvl: 567, tolerance: 0, pnl: 203, pnlTolerance: 0, seconds: 1435, secondsTolerance: 0 })) hits.push(p.positionAddress);
    }, { pair: 'BIDDY-SOL' });
    assert.deepEqual(hits, [position.positionAddress]);
    assert.equal(calls.length, 6);
    assert.equal(calls.filter(([, , proxy]) => proxy).length, 2);
  } finally { globalThis.fetch = original; }
});

test('keeps legacy proxy pagination compatible with open tabs', () => {
  assert.equal(new URL(historyUrl('wallet', null, '2', null)).searchParams.get('page_size'), '50');
  const legacyPositions = new URL(historyUrl('wallet', 'pool', '2', null));
  assert.equal(legacyPositions.searchParams.get('status'), 'closed');
  assert.equal(legacyPositions.searchParams.has('page_size'), false);
});
