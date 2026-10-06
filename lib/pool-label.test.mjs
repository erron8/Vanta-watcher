import assert from 'node:assert/strict';
import { test } from 'node:test';
import { primaryPool, SOL_MINT, USDC_MINT, shortToken } from './pool-label.ts';

const MEME = '91ryaCo5yGpYZM3bs6GUPs97VWJQj7RozBmqPULgpump';

test('finds the dominant liquidity pool despite reversed rows and swaps', () => {
  const csv = [['Action', 'Token1', 'Token2'], ['ACTIVITY_TOKEN_ADD_LIQ', MEME, SOL_MINT], ['ACTIVITY_TOKEN_REMOVE_LIQ', SOL_MINT, MEME], ['ACTIVITY_TOKEN_SWAP', USDC_MINT, MEME], ['ACTIVITY_TOKEN_ADD_LIQ', MEME, SOL_MINT]];
  assert.deepEqual(primaryPool(csv), { base: MEME, quote: SOL_MINT });
});

test('puts USDC on the quote side and handles CSVs without pool columns', () => {
  assert.deepEqual(primaryPool([['Token1', 'Token2'], [USDC_MINT, SOL_MINT]]), { base: SOL_MINT, quote: USDC_MINT });
  assert.equal(primaryPool([['From'], ['wallet']]), null);
  assert.equal(shortToken(SOL_MINT), 'SOL');
});
