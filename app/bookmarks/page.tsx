"use client";
import { useState } from "react";
import { Navigation, WalletAddress } from "../screener-ui";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Plus } from 'lucide-react';
import { isSolanaAddress } from '@/lib/solana-address';
import { BookmarkCategoryPicker } from '../bookmark-category-picker';
import { emptyCategories, type BookmarkCategories } from '@/lib/bookmark-categories';
import { useLocalBookmarks } from '@/lib/local-bookmarks';

export default function Bookmarks() {
  const { rows, loading, error: storageError, add, rename: renameLocal, remove: removeLocal, saveCategories: saveLocalCategories } = useLocalBookmarks();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [adding, setAdding] = useState(false);
  async function addWallet() {
    const address = newAddress.trim();
    setError(''); setNotice('');
    if (!isSolanaAddress(address)) { setError('Enter a valid Solana wallet address.'); return; }
    setAdding(true);
    try {
      const { created } = add(address);
      setNewAddress('');
      setNotice(created ? 'Wallet added to bookmarks.' : 'This wallet was already bookmarked.');
    } catch (e) { setError((e as Error).message); }
    finally { setAdding(false); }
  }
  async function rename(address: string) {
    if (pending) return;
    setPending(address); setError(''); setNotice('');
    try {
      renameLocal(address, draft);
      setEditing(null); setNotice(draft.trim() ? 'Wallet name saved.' : 'Wallet name cleared.');
    } catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  }
  async function remove(address: string) {
    setPending(address); setError("");
    try {
      removeLocal(address);
    } catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  }
  async function saveCategories(address: string, categories: BookmarkCategories) {
    saveLocalCategories(address, categories);
    setNotice('Wallet categories saved.');
  }
  return <main className="terminal"><Navigation active="bookmarks" /><div className="bookmarks-content">
    <div className="bookmarks-heading"><h1>Bookmarked wallets</h1><span className="count-badge">{rows.length}</span></div>
    <p className="panel-note">Saved only in this browser for the signed-in account. Clearing site data removes these bookmarks.</p>
    <form className="bookmark-add" onSubmit={e => { e.preventDefault(); void addWallet(); }}><label htmlFor="new-wallet-address">Add a Solana wallet</label><div><Input id="new-wallet-address" name="walletAddress" value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Paste a Solana wallet address" autoComplete="off" spellCheck={false} disabled={adding || loading} /><Button type="submit" disabled={adding || loading || !newAddress.trim()}><Plus size={15} />{adding ? 'Adding…' : 'Add wallet'}</Button></div></form>
    {(error || storageError) && <p className="error-banner" role="alert">{error || storageError}</p>}
    <p className="bookmark-notice" role="status">{notice}</p>
    <div className="bookmark-list">{rows.map(row => <div className="bookmark-item" key={row.address}>
      <div className="bookmark-wallet"><WalletAddress address={row.address} name={row.name} marked pending={pending !== null} onBookmark={() => remove(row.address)} onError={setError} labels={<BookmarkCategoryPicker address={row.address} categories={row.categories || emptyCategories} onSave={categories => saveCategories(row.address, categories)} />} />
      {editing === row.address && <form className="bookmark-rename" onSubmit={e => { e.preventDefault(); void rename(row.address); }} onKeyDown={e => { if (e.key === 'Escape' && !pending) setEditing(null); }}><label htmlFor={'name-' + row.address}>Wallet name <small>Optional · up to 80 characters</small></label><div><Input id={'name-' + row.address} autoFocus maxLength={80} value={draft} disabled={pending !== null} placeholder="e.g. SOL trader" onChange={e => setDraft(e.target.value)} /><Button type="submit" disabled={pending !== null}>{pending === row.address ? 'Saving…' : 'Save'}</Button><Button type="button" variant="outline" disabled={pending !== null} onClick={() => setEditing(null)}>Cancel</Button></div></form>}</div>
      <div className="bookmark-actions"><Button variant="outline" disabled={pending !== null} aria-label={`Rename ${row.name || row.address}`} onClick={() => { setEditing(row.address); setDraft(row.name || ''); setError(''); setNotice(''); }}><Pencil size={14} />Rename</Button><time dateTime={row.createdAt}>Saved {new Date(row.createdAt).toLocaleDateString()}</time></div>
    </div>)}{!rows.length && <div className="empty-table"><strong>{loading ? "Loading bookmarks…" : "No bookmarked wallets yet"}</strong><span>Use the star beside a wallet to save it here.</span></div>}</div>
  </div></main>;
}
