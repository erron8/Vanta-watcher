import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseScanRow, parseScanRows } from './scan-validation.ts';

const address = 'So11111111111111111111111111111111111111112';
const sample = {
  address, activities: 1, avgInvested: 100, pnl30d: 3, activeDays: 1,
  maxLoss: 0, monthlyProfit: 3,
  calendar: [{ date_time: '2026-10-01T00:00:00+00:00', pnl_usd: '3', pnl_sol: '0.02', closed_position_count: 1 }],
};

test('accepts upstream calendar days and strips unrelated fields', () => {
  const row = parseScanRow({ ...sample, calendar: [{ ...sample.calendar[0], ignored: { nested: true } }] });
  assert.equal(row?.calendar[0].pnl_usd, '3');
  assert.equal('ignored' in row.calendar[0], false);
});

test('rejects malformed saved days and nonfinite or duplicate wallet metrics', () => {
  for (const bad of [null, {}, { pnl_usd: '3' }, { date_time: '2026-10-01', pnl_usd: 'not a number' }]) {
    assert.equal(parseScanRow({ ...sample, calendar: [bad] }), null);
  }
  assert.equal(parseScanRow({ ...sample, monthlyProfit: Infinity }), null);
  assert.equal(parseScanRows([sample, sample]), null);
});
