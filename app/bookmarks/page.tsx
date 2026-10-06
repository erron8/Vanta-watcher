"use client";
import { useEffect, useState } from "react";
import { Navigation, WalletAddress } from "../screener-ui";
import { LabelControls } from '../wallet-labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil } from 'lucide-react';

export default function Bookmarks() {
  const [rows, setRows] = useState<{ address: string; name: string; createdAt: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/bookmarks").then(async r => { if (!r.ok) throw new Error("Could not load bookmarks."); return r.json() as Promise<{ address: string; name: string; createdAt: string }[]>; })
      .then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  async function rename(address: string) {
    if (pending) return;
    setPending(address); setError(''); setNotice('');
    try {
      const response = await fetch('/api/bookmarks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, name: draft }) });
      const data = await response.json() as { name?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save the wallet name.');
      setRows(prev => prev.map(row => row.address === address ? { ...row, name: data.name || '' } : row));
      setEditing(null); setNotice(data.name ? 'Wallet name saved.' : 'Wallet name cleared.');
    } catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  }
  async function remove(address: string) {
    setPending(address); setError("");
    try {
      const r = await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      if (!r.ok) throw new Error("Could not remove the bookmark.");
      setRows(prev => prev.filter(row => row.address !== address));
    } catch (e) { setError((e as Error).message); }
    finally { setPending(null); }
  }
  return <main className="terminal"><Navigation active="bookmarks" /><div className="bookmarks-content">
    <div className="bookmarks-heading"><h1>Bookmarked wallets</h1><span className="count-badge">{rows.length}</span></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <p className="bookmark-notice" role="status">{notice}</p>
    <LabelControls addresses={rows.map(r => r.address)} />
    <div className="bookmark-list">{rows.map(row => <div className="bookmark-item" key={row.address}>
      <div className="bookmark-wallet"><WalletAddress address={row.address} name={row.name} marked pending={pending !== null} onBookmark={() => remove(row.address)} onError={setError} />
      {editing === row.address && <form className="bookmark-rename" onSubmit={e => { e.preventDefault(); void rename(row.address); }} onKeyDown={e => { if (e.key === 'Escape' && !pending) setEditing(null); }}><label htmlFor={'name-' + row.address}>Wallet name <small>Optional · up to 80 characters</small></label><div><Input id={'name-' + row.address} autoFocus maxLength={80} value={draft} disabled={pending !== null} placeholder="e.g. SOL trader" onChange={e => setDraft(e.target.value)} /><Button type="submit" disabled={pending !== null}>{pending === row.address ? 'Saving…' : 'Save'}</Button><Button type="button" variant="outline" disabled={pending !== null} onClick={() => setEditing(null)}>Cancel</Button></div></form>}</div>
      <div className="bookmark-actions"><Button variant="outline" disabled={pending !== null} aria-label={`Rename ${row.name || row.address}`} onClick={() => { setEditing(row.address); setDraft(row.name || ''); setError(''); setNotice(''); }}><Pencil size={14} />Rename</Button><time dateTime={row.createdAt}>Saved {new Date(row.createdAt).toLocaleDateString()}</time></div>
    </div>)}{!rows.length && <div className="empty-table"><strong>{loading ? "Loading bookmarks…" : "No bookmarked wallets yet"}</strong><span>Use the star beside a wallet to save it here.</span></div>}</div>
  </div></main>;
}
