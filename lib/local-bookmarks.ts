"use client";

import { useCallback, useEffect, useState } from 'react';
import { emptyCategories, parseCategories, type BookmarkCategories } from './bookmark-categories.ts';
import { isSolanaAddress } from './solana-address.ts';

export type BookmarkRow = { address: string; name: string; createdAt: string; categories: BookmarkCategories };
type Account = string;
const validAccount = (value: unknown): value is Account => typeof value === 'string' && (value === 'admin' || value === 'guest' || /^member:[0-9a-f-]{36}$/.test(value));

export const bookmarkStorageKey = (account: Account) => `vanta:bookmarks:local:v1:${account}`;

export function readBookmarks(account: Account): BookmarkRow[] {
  const raw = localStorage.getItem(bookmarkStorageKey(account));
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Saved bookmarks could not be read from this browser.');
  return value.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
    .filter(row => typeof row.address === 'string' && isSolanaAddress(row.address))
    .map(row => ({
      address: row.address as string,
      name: typeof row.name === 'string' ? row.name.slice(0, 80) : '',
      createdAt: typeof row.createdAt === 'string' && !Number.isNaN(Date.parse(row.createdAt)) ? row.createdAt : new Date().toISOString(),
      categories: parseCategories(row.categories) ?? { ...emptyCategories },
    }));
}

export function writeBookmarks(account: Account, rows: BookmarkRow[]) {
  localStorage.setItem(bookmarkStorageKey(account), JSON.stringify(rows));
}

export function useLocalBookmarks() {
  const [account, setAccount] = useState<Account | null>(null);
  const [rows, setRows] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Sign in to load your bookmarks.');
        const data = await response.json() as { account?: string };
        if (!validAccount(data.account)) throw new Error('Could not identify the signed-in account.');
        return data.account;
      })
      .then(value => { if (active) { setRows(readBookmarks(value)); setAccount(value); } })
      .catch(cause => { if (active) setError((cause as Error).message || 'Could not load local bookmarks.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!account) return;
    const sync = (event: StorageEvent) => {
      if (event.key !== bookmarkStorageKey(account) && event.key !== null) return;
      try { setRows(readBookmarks(account)); setError(''); }
      catch (cause) { setError((cause as Error).message || 'Could not load local bookmarks.'); }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [account]);

  const update = useCallback((change: (current: BookmarkRow[]) => BookmarkRow[]) => {
    if (!account) throw new Error('Your bookmarks are still loading.');
    try {
      const next = change(readBookmarks(account));
      writeBookmarks(account, next);
      setRows(next);
      setError('');
      return next;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save bookmarks in this browser.';
      setError(message);
      throw new Error(message);
    }
  }, [account]);

  const add = useCallback((address: string, name = '') => {
    if (!isSolanaAddress(address)) throw new Error('Enter a valid Solana wallet address.');
    if (name.trim().length > 80) throw new Error('Enter a name of up to 80 characters.');
    let created = false;
    const next = update(current => {
      const existing = current.find(row => row.address === address);
      if (existing) return current.map(row => row.address === address && name.trim() ? { ...row, name: name.trim() } : row);
      created = true;
      return [{ address, name: name.trim(), createdAt: new Date().toISOString(), categories: { ...emptyCategories } }, ...current];
    });
    return { row: next.find(row => row.address === address)!, created };
  }, [update]);

  const rename = useCallback((address: string, name: string) => {
    if (name.trim().length > 80) throw new Error('Enter a name of up to 80 characters.');
    update(current => current.map(row => row.address === address ? { ...row, name: name.trim() } : row));
  }, [update]);

  const remove = useCallback((address: string) => {
    update(current => current.filter(row => row.address !== address));
  }, [update]);

  const saveCategories = useCallback((address: string, value: BookmarkCategories) => {
    const categories = parseCategories(value);
    if (!categories) throw new Error('Choose valid wallet categories.');
    update(current => current.map(row => row.address === address ? { ...row, categories } : row));
  }, [update]);

  return { rows, loading, error, add, rename, remove, saveCategories };
}
