import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPositions, labelsFor } from './wallet-labels.ts';
const sol = 'So11111111111111111111111111111111111111112';
const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
function sample(hold = 600, bins = 30) {
  return Array.from({ length: 30 }, (_, i) => ({ positionAddress: String(i), closedAt: 1800000000 + i, createdAt: 1800000000 + i - hold, lowerBinId: -10, upperBinId: -10 + bins - 1, pool: { tokenXMint: 'base', tokenYMint: sol }, allTimeDeposits: { tokenX: { amount: '0' }, tokenY: { amount: '5' } } }));
}
test('quote majority requires 16, permits USDC, and rejects token symbols as proof', () => {
  const positions = sample();
  for (let i = 0; i < 14; i++) positions[i].allTimeDeposits.tokenX.amount = '1';
  positions[29].pool.tokenYMint = usdc;
  assert.deepEqual(labelsFor(classifyPositions(positions)), ['Quote only', 'Degen']);
  positions[14].allTimeDeposits.tokenX.amount = '1';
  assert.deepEqual(labelsFor(classifyPositions(positions)), ['Degen']);
  const fake = sample().map(p => ({ ...p, pool: { tokenY: 'SOL', tokenXMint: 'base', tokenYMint: 'fake' } }));
  assert.equal(labelsFor(classifyPositions(fake)).includes('Quote only'), false);
});
test('strict hold thresholds and inclusive 30-bin width', () => {
  assert.equal(labelsFor(classifyPositions(sample(3600))).includes('Multi'), false);
  assert.equal(labelsFor(classifyPositions(sample(3601))).includes('Multi'), true);
  assert.equal(labelsFor(classifyPositions(sample(900))).includes('Degen'), false);
  assert.equal(labelsFor(classifyPositions(sample(899, 30))).includes('Degen'), true);
  assert.equal(labelsFor(classifyPositions(sample(899, 31))).includes('Degen'), false);
});
test('latest 30 selected globally and duplicates excluded', () => {
  const positions = sample();
  const old = { ...positions[0], positionAddress: 'old', closedAt: 1700000000, createdAt: 1600000000, upperBinId: 1000 };
  const profile = classifyPositions([old, ...positions.reverse(), positions[0]]);
  assert.equal(profile.sampleCount, 30); assert.equal(profile.avgHoldSeconds, 600); assert.equal(profile.maxBins, 30);
});
test('insufficient samples and unavailable metrics never produce unsupported labels', () => {
  assert.deepEqual(labelsFor(classifyPositions(sample().slice(0, 29))), []);
  const positions = sample(); delete positions[0].upperBinId; delete positions[0].allTimeDeposits.tokenY;
  const profile = classifyPositions(positions);
  assert.equal(profile.maxBins, null); assert.equal(profile.quoteCount, null); assert.deepEqual(labelsFor(profile), []);
});
