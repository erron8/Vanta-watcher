"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, Search, X } from 'lucide-react';
import { isSolanaAddress } from '@/lib/solana-address';
import { solscanLiquidityUrl, type PoolSearchPage } from '@/lib/pool-search';

export function PoolSearch() {
  const [mint, setMint] = useState('');
  const [result, setResult] = useState<PoolSearchPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); pending.current?.abort(); };
  }, []);

  async function search(page = 1) {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const address = mint.trim();
    setOpen(true); setError('');
    if (page === 1) setResult(null);
    if (!isSolanaAddress(address)) { setError('Enter a valid Solana token contract address.'); setBusy(false); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/pool-search?${new URLSearchParams({ mint: address, page: String(page) })}`, { signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || 'Could not load pools. Try again.');
      }
      const data = await response.json() as PoolSearchPage;
      if (controller.signal.aborted) return;
      setResult(previous => ({ ...data, pools: page === 1 ? data.pools : [...new Map([...(previous?.pools || []), ...data.pools].map(pool => [pool.address, pool])).values()] }));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load pools.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <div ref={container} className="token-pool-search" onKeyDown={event => { if (event.key === 'Escape') { input.current?.focus(); setOpen(false); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <form className="pool-search-field" onSubmit={event => { event.preventDefault(); void search(); }}>
      <Search size={17} aria-hidden="true" />
      <input ref={input} aria-label="Solana token contract address" placeholder="Paste a token contract address" value={mint} maxLength={100} spellCheck={false} autoComplete="off" onFocus={() => { if (result || error || busy) setOpen(true); }} onChange={event => { pending.current?.abort(); setBusy(false); setResult(null); setError(''); setOpen(false); setMint(event.target.value); }} />
      <button type="submit" disabled={busy} aria-expanded={open} aria-controls="token-pool-results">{busy ? <Loader2 size={14} className="spin" aria-label="Searching" /> : 'Search'}</button>
    </form>
    {open && <section id="token-pool-results" className="pool-search-results" aria-label="DLMM pool results" aria-busy={busy}>
      <div className="pool-results-heading"><strong>DLMM pools{result ? ` · ${result.pools.length}${result.page < result.pages ? ` of ${result.total}` : ''}` : ''}</strong><button type="button" className="icon-button" aria-label="Close pool results" onClick={() => { input.current?.focus(); setOpen(false); }}><X size={16} /></button></div>
      <p className="pool-results-hint">Select a pool to view add-liquidity activity on Solscan.</p>
      {error && <p className="pool-results-error" role="alert">{error}</p>}
      {result && result.pools.length === 0 && !busy && <p className="pool-results-message">No DLMM pools found for this token.</p>}
      {!!result?.pools.length && <ul className="pool-results-list">{result.pools.map(pool => <li key={pool.address}><a href={solscanLiquidityUrl(pool.address)} target="_blank" rel="noopener noreferrer" aria-label={`${pool.pair}, bin step ${pool.binStep ?? 'unavailable'}, base fee ${pool.baseFeePct ?? 'unavailable'} percent. Open on Solscan in a new tab.`}>
        <div><strong>{pool.pair}</strong><span className="pool-result-metrics">Bin step <b>{pool.binStep ?? '—'}</b><span aria-hidden="true">·</span>Base fee <b>{pool.baseFeePct === null ? '—' : `${pool.baseFeePct}%`}</b></span><span className="pool-result-address" title={pool.address}>{pool.address}</span></div><ArrowUpRight size={17} aria-hidden="true" />
      </a></li>)}</ul>}
      {busy && <p className="pool-results-message" role="status">Loading pools…</p>}
      {result && result.page < result.pages && <button type="button" className="pool-results-more" disabled={busy} onClick={() => void search(result.page + 1)}>Load more pools</button>}
      {error && !busy && <button type="button" className="pool-results-more" onClick={() => void search(result ? result.page + 1 : 1)}>Try again</button>}
    </section>}
  </div>;
}
