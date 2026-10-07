import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestCategories } from './category-analysis.ts';

const sol = 'So11111111111111111111111111111111111111112';
const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
function sample() {
  return Array.from({ length: 30 }, (_, i) => ({
    positionAddress: String(i), closedAt: 1800000000 + i, createdAt: 1799999400 + i,
    lowerBinId: 0, upperBinId: 19,
    pool: { tokenXMint: 'base-token', tokenYMint: sol },
    allTimeDeposits: { tokenX: { amount: '5' }, tokenY: { amount: '0' } },
  }));
}

test('Meme only means a majority of base-only deposits in a SOL or USDC pair', () => {
  const positions = sample();
  for (let i = 0; i < 14; i++) {
    positions[i].allTimeDeposits.tokenX.amount = '0';
    positions[i].allTimeDeposits.tokenY.amount = '5';
  }
  const result = suggestCategories(positions);
  assert.equal(result.categories.deposits, 'Meme only');
  assert.equal(result.evidence.deposits.baseOnly, 16);
  assert.equal(result.evidence.deposits.quoteOnly, 14);

  for (const position of positions.slice(14, 16)) {
    position.allTimeDeposits.tokenX.amount = '0';
    position.allTimeDeposits.tokenY.amount = '5';
  }
  assert.equal(suggestCategories(positions).categories.deposits, 'Quote only');
});

test('USDC pair base-only deposits count, but SOL-only in SOL-USDC does not become Meme only', () => {
  const positions = sample();
  positions.forEach(position => { position.pool.tokenYMint = usdc; });
  assert.equal(suggestCategories(positions).categories.deposits, 'Meme only');
  positions.forEach(position => { position.pool.tokenXMint = sol; });
  assert.equal(suggestCategories(positions).categories.deposits, 'Quote only');
});

test('unknown quote side and fewer than 30 closed positions remain unclassified', () => {
  const positions = sample();
  positions.forEach(position => { position.pool.tokenYMint = 'another-token'; });
  assert.equal(suggestCategories(positions).categories.deposits, null);
  assert.equal(suggestCategories(sample().slice(0, 29)).categories.deposits, null);
});
