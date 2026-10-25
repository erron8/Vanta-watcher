import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeTelegramHandle } from './waitlist.ts';

test('normalizes Telegram handles for a unique waitlist entry', () => {
  assert.equal(normalizeTelegramHandle(' @Trader_One '), '@trader_one');
  assert.equal(normalizeTelegramHandle('Trader_One'), '@trader_one');
  for (const value of ['', '@abc', 'name with spaces', 'https://t.me/trader', 123, null]) {
    assert.equal(normalizeTelegramHandle(value), null);
  }
});
