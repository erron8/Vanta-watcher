import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkStorageKey, readBookmarks, writeBookmarks } from './local-bookmarks.ts';

test('bookmarks persist per browser and sign-in without crossing accounts', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const row = {
    address: 'So11111111111111111111111111111111111111112',
    name: 'My wallet',
    createdAt: '2026-10-20T00:00:00.000Z',
    categories: { deposits: 'Quote only', timezone: null, hold: null, range: null },
  };
  writeBookmarks('admin', [row]);
  assert.deepEqual(readBookmarks('admin'), [row]);
  assert.deepEqual(readBookmarks('guest'), []);
  assert.notEqual(bookmarkStorageKey('admin'), bookmarkStorageKey('guest'));
  assert.equal(values.size, 1);
});
