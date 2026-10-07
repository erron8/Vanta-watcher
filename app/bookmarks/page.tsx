"use client";
import { useEffect, useState } from "react";
import { Navigation, WalletAddress } from "../screener-ui";
import { LabelControls } from '../wallet-labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Plus } from 'lucide-react';
import { isSolanaAddress } from '@/lib/solana-address';
import { readSessionCache, writeSessionCache } from '@/lib/session-cache';
import { BookmarkCategoryPicker } from '../bookmark-category-picker';
import { emptyCategories, type BookmarkCategories } from '@/lib/bookmark-categories';

type BookmarkRow = { address: string; name: string; createdAt: string; categories?: BookmarkCategories };
const bookmarkCacheKey = 'vanta:bookmarks:v1';
let recentBookmarks: BookmarkRow[] | null = null;

export default function Bookmarks() {
  const [rows, setRows] = useState<BookmarkRow[]>(() => recentBookmarks || []);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(() => recentBookmarks === null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    let active = true;
    const cached = readSessionCache<BookmarkRow[]>(bookmarkCacheKey);
    if (cached) Promise.resolve().then(() => { if (active) { recentBookmarks = cached; setRows(cached); setLoading(false); } });
    fetch("/api/bookmarks").then(async r => { if (!r.ok) throw new Error("Could not load bookmarks."); return r.json() as Promise<BookmarkRow[]>; })
      .then(data => { if (active) { recentBookmarks = data; writeSessionCache(bookmarkCacheKey, data); setRows(data); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function addWallet() {
    const address = newAddress.trim();
    setError(''); setNotice('');
    if (!isSolanaAddress(address)) { setError('Enter a valid Solana wallet address.'); return; }
    setAdding(true);
    try {
      const response = await fetch('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address }) });
      const data = await response.json() as { address?: string; name?: string; createdAt?: string; categories?: BookmarkCategories; created?: boolean; error?: string };
      if (!response.ok || !data.address || !data.createdAt) throw new Error(data.error || 'Could not save the wallet. Please retry.');
      setRows(prev => { const next = [{ address: data.address!, name: data.name || '', createdAt: data.createdAt!, categories: data.categories || { ...emptyCategories } }, ...prev.filter(row => row.address !== data.address)]; recentBookmarks = next; writeSessionCache(bookmarkCacheKey, next); return next; });
      setNewAddress('');
      setNotice(data.created ? 'Wallet added to bookmarks.' : 'This wallet was already bookmarked.');
    } catch (e) { setError((e as Error).message); }
    finally { setAdding(false); }
  }
  async function rename(address: string) {
    if (pending) return;
    setPending(address); setError(''); setNotice('');
    try {
      const response = await fetch('/api/bookmarks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, name: draft }) });
      const data = await response.json() as { name?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save the wallet name.');
      setRows(prev => { const next = prev.map(row => row.address === address ? { ...row, name: data.name || '' } : row); recentBookmarks = next; writeSessionCache(bookmarkCacheKey, next); return next; });
      setEditing(null); setNotice(data.name ? 'Wallet name saved.' : 'Wallet name cleared.');
    } catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  }
  async function remove(address: string) {
    setPending(address); setError("");
    try {
      const r = await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      if (!r.ok) throw new Error("Could not remove the bookmark.");
      setRows(prev => { const next = prev.filter(row => row.address !== address); recentBookmarks = next; writeSessionCache(bookmarkCacheKey, next); return next; });
    } catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  }
  async function saveCategories(address: string, categories: BookmarkCategories) {
    const response = await fetch('/api/bookmarks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, categories }) });
    const data = await response.json() as { categories?: BookmarkCategories; error?: string };
    if (!response.ok || !data.categories) throw new Error(data.error || 'Could not save wallet categories.');
    setRows(prev => { const next = prev.map(row => row.address === address ? { ...row, categories: data.categories } : row); recentBookmarks = next; writeSessionCache(bookmarkCacheKey, next); return next; });
    setNotice('Wallet categories saved.');
  }
  return <main className="terminal"><Navigation active="bookmarks" /><div className="bookmarks-content">
    <div className="bookmarks-heading"><h1>Bookmarked wallets</h1><span className="count-badge">{rows.length}</span></div>
    <form className="bookmark-add" onSubmit={e => { e.preventDefault(); void addWallet(); }}><label htmlFor="new-wallet-address">Add a Solana wallet</label><div><Input id="new-wallet-address" name="walletAddress" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Paste a Solana wallet address" autoComplete="off" spellCheck={false} disabled={adding} /><Button type="submit" disabled={adding || !newAddress.trim()}><Plus size={15} />{adding ? 'Adding…' : 'Add wallet'}</Button></div></form>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <p className="bookmark-notice" role="status">{notice}</p>
    <LabelControls addresses={rows.map(r => r.address)} />
    <div className="bookmark-list">{rows.map(row => <div className="bookmark-item" key={row.address}>
      <div className="bookmark-wallet"><WalletAddress address={row.address} name={row.name} marked pending={pending !== null} onBookmark={() => remove(row.address)} onError={setError} labels={<BookmarkCategoryPicker address={row.address} categories={row.categories || emptyCategories} onSave={categories => saveCategories(row.address, categories)} />} />
      {editing === row.address && <form className="bookmark-rename" onSubmit={e => { e.preventDefault(); void rename(row.address); }} onKeyDown={e => { if (e.key === 'Escape' && !pending) setEditing(null); }}><label htmlFor={'name-' + row.address}>Wallet name <small>Optional · up to 80 characters</small></label><div><Input id={'name-' + row.address} autoFocus maxLength={80} value={draft} disabled={pending !== null} placeholder="e.g. SOL trader" onChange={e => setDraft(e.target.value)} /><Button type="submit" disabled={pending !== null}>{pending === row.address ? 'Saving…' : 'Save'}</Button><Button type="button" variant="outline" disabled={pending !== null} onClick={() => setEditing(null)}>Cancel</Button></div></form>}</div>
      <div className="bookmark-actions"><Button variant="outline" disabled={pending !== null} aria-label={`Rename ${row.name || row.address}`} onClick={() => { setEditing(row.address); setDraft(row.name || ''); setError(''); setNotice(''); }}><Pencil size={14} />Rename</Button><time dateTime={row.createdAt}>Saved {new Date(row.createdAt).toLocaleDateString()}</time></div>
    </div>)}{!rows.length && <div className="empty-table"><strong>{loading ? "Loading bookmarks…" : "No bookmarked wallets yet"}</strong><span>Use the star beside a wallet to save it here.</span></div>}</div>
  </div></main>;
}
