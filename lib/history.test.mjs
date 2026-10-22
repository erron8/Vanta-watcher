import assert from 'node:assert/strict';
import { test } from 'node:test';
import { history, matches, duration } from './history.ts';

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
