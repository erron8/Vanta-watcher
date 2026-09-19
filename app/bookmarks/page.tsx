"use client";
import { useEffect, useState } from "react";
import { Navigation, WalletAddress } from "../screener-ui";

export default function Bookmarks() {
  const [rows, setRows] = useState<{ address: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/bookmarks").then(async r => { if (!r.ok) throw new Error("Could not load bookmarks."); return r.json() as Promise<{ address: string; createdAt: string }[]>; })
      .then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
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
    <div className="bookmark-list">{rows.map(row => <div className="bookmark-item" key={row.address}>
      <WalletAddress address={row.address} marked pending={pending === row.address} onBookmark={() => remove(row.address)} onError={setError} />
      <time dateTime={row.createdAt}>Saved {new Date(row.createdAt).toLocaleDateString()}</time>
    </div>)}{!rows.length && <div className="empty-table"><strong>{loading ? "Loading bookmarks…" : "No bookmarked wallets yet"}</strong><span>Use the star beside a wallet to save it here.</span></div>}</div>
  </div></main>;
}
