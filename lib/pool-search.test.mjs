import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePoolSearch, solscanLiquidityUrl } from './pool-search.ts';
const mint = '2gLhk8p2KvUFeUXur2hiF4hxjdRM1vBcbgo9Q7DMZfiw';
const address = 'F7J2Mpnh3sbbqiYKmf1cHUFVrxjGWZZcAc6dQSjXUgCr';
const pool = { address, token_x: { address: mint, symbol: 'INVERSE' }, token_y: { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' }, pool_config: { bin_step: 125, base_fee_pct: 1 } };
const page = data => ({ data, pages: 2, total: 103, current_page: 1 });
test('returns exact mint pools, keeps percentage units, and deduplicates addresses', () => {
  const result = parsePoolSearch(page([pool, pool, { ...pool, address: mint, token_x: { address: address, symbol: 'OTHER' } }]), mint, 1);
  assert.deepEqual(result, { pools: [{ address, pair: 'INVERSE-SOL', binStep: 125, baseFeePct: 1 }], page: 1, pages: 2, total: 103 });
});
test('matches token on either side and preserves zero fees', () => {
  const result = parsePoolSearch(page([{ ...pool, token_x: pool.token_y, token_y: pool.token_x, pool_config: { bin_step: 100, base_fee_pct: 0 } }]), mint, 1);
  assert.equal(result.pools[0].pair, 'SOL-INVERSE');
  assert.equal(result.pools[0].baseFeePct, 0);
});
test('rejects broken pagination, ignores unsafe addresses, and does not fabricate missing fees', () => {
  assert.throws(() => parsePoolSearch({}, mint, 1));
  assert.throws(() => parsePoolSearch(page([]), mint, 2));
  assert.deepEqual(parsePoolSearch(page([{ ...pool, address: 'javascript:alert(1)' }]), mint, 1).pools, []);
  assert.equal(parsePoolSearch(page([{ ...pool, pool_config: {} }]), mint, 1).pools[0].baseFeePct, null);
});
test('Solscan link retains the selected pool and liquidity activity filters', () => {
  const url = new URL(solscanLiquidityUrl(address));
  assert.equal(url.origin, 'https://solscan.io');
  assert.equal(url.pathname, `/account/${address}`);
  assert.equal(url.searchParams.get('activity_type'), 'ACTIVITY_TOKEN_ADD_LIQ,ACTIVITY_TOKEN_DEPOSIT_VAULT');
  assert.equal(url.hash, '#activities');
  assert.throws(() => solscanLiquidityUrl('bad-address'));
});
