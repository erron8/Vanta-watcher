"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Loader2, Search, X } from 'lucide-react';
import { isSolanaAddress } from '@/lib/solana-address';
import { solscanLiquidityUrl, type PoolSearchPage } from '@/lib/pool-search';

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', minimumFractionDigits: 2, maximumFractionDigits: 2 });
function usd(value: number | null) {
  return value == null ? '—' : dollars.format(value);
}

async function fetchPools(address: string, page: number, signal: AbortSignal): Promise<PoolSearchPage> {
  const response = await fetch(`/api/pool-search?${new URLSearchParams({ mint: address, page: String(page) })}`, { signal, cache: 'no-store' });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || 'Could not load pools. Try again.');
  }
  return response.json();
}

export function PoolSearch() {
  const [mint, setMint] = useState('');
  const [result, setResult] = useState<PoolSearchPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => { pending.current?.abort(); if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!open) { element.close(); return; }
    element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (element.open) element.close(); };
  }, [open]);

  const loadedPages = result?.page ?? 0;
  const [refreshFailed, setRefreshFailed] = useState(false);
  useEffect(() => {
    if (!open || busy || !loadedPages) return;
    const controller = new AbortController();
    let refreshing = false;
    async function refresh() {
      if (document.hidden || refreshing || controller.signal.aborted) return;
      refreshing = true;
      try {
        let data = await fetchPools(mint.trim(), 1, controller.signal);
        const pools = new Map(data.pools.map(pool => [pool.address, pool]));
        for (let page = 2; page <= Math.min(loadedPages, data.pages); page++) {
          data = await fetchPools(mint.trim(), page, controller.signal);
          for (const pool of data.pools) pools.set(pool.address, pool);
        }
        if (!controller.signal.aborted) {
          setResult({ ...data, pools: [...pools.values()] });
          setRefreshFailed(false);
        }
      } catch {
        if (!controller.signal.aborted) setRefreshFailed(true);
      } finally {
        refreshing = false;
      }
    }
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [open, busy, loadedPages, mint]);

  function changeMint(value: string) {
    pending.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    setMint(value); setResult(null); setError(''); setBusy(false);
    if (isSolanaAddress(value.trim())) {
      setOpen(true);
      setBusy(true);
      timer.current = setTimeout(() => { void search(1, value); }, 250);
    }
  }

  function close() {
    if (timer.current) clearTimeout(timer.current);
    pending.current?.abort(); setBusy(false); setOpen(false);
  }

  async function search(page = 1, value = mint) {
    if (timer.current) clearTimeout(timer.current);
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const address = value.trim();
    setOpen(true); setError(''); setRefreshFailed(false);
    if (page === 1) setResult(null);
    if (!isSolanaAddress(address)) { setError('Enter a valid Solana token contract address.'); setBusy(false); return; }
    setBusy(true);
    try {
      const data = await fetchPools(address, page, controller.signal);
      if (controller.signal.aborted) return;
      setResult(previous => ({ ...data, pools: page === 1 ? data.pools : [...new Map([...(previous?.pools || []), ...data.pools].map(pool => [pool.address, pool])).values()] }));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not load pools.');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  const searchField = (inPopup: boolean) => <form className="pool-search-field" onSubmit={event => { event.preventDefault(); void search(); }}>
    <Search size={17} aria-hidden="true" />
    <input aria-label={inPopup ? 'Search token contract address' : 'Solana token contract address'} placeholder="Paste a token contract address" value={mint} maxLength={100} spellCheck={false} autoComplete="off" onChange={event => changeMint(event.target.value)} />
    <button type="submit" disabled={busy} aria-haspopup={inPopup ? undefined : 'dialog'}>{busy ? <Loader2 size={14} className="spin" aria-label="Searching" /> : 'Search'}</button>
  </form>;

  return <div className="token-pool-search">
    {searchField(false)}
    <dialog ref={dialog} className="pool-search-dialog" aria-labelledby="pool-search-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }}>
      <div className="pool-popup-search">{searchField(true)}<button type="button" className="pool-popup-close" aria-label="Close pool search" onClick={close}><span>Esc</span><X size={16} /></button></div>
      <div className="pool-results-heading"><strong id="pool-search-title">DLMM pools{result ? ` · ${result.pools.length}${result.page < result.pages ? ` of ${result.total}` : ''}` : ''}</strong></div>
      <p className="pool-results-hint">Select a pool to view add-liquidity activity on Solscan.</p>
      {!result && !busy && !error && <p className="pool-results-message">Paste a token contract address to find its DLMM pools.</p>}
      {result && refreshFailed && <p className="pool-results-error" role="status">Refresh failed. Showing the last available figures.</p>}
      {error && <p className="pool-results-error" role="alert">{error}</p>}
      {result && result.pools.length === 0 && !busy && <p className="pool-results-message">No DLMM pools found for this token.</p>}
      {!!result?.pools.length && <ul className="pool-results-list">{result.pools.map(pool => <li key={pool.address}><a href={solscanLiquidityUrl(pool.address)} target="_blank" rel="noopener noreferrer" title="Open add-liquidity activity on Solscan in a new tab">
        <div><strong>{pool.pair}</strong><span className="pool-result-metrics">Bin step <b>{pool.binStep ?? '—'}</b><span aria-hidden="true">·</span>Base fee <b>{pool.baseFeePct === null ? '—' : `${pool.baseFeePct}%`}</b></span><span className="pool-result-address" title={pool.address}>{pool.address}</span></div>
        <dl className="pool-live-stats">
          <div><dt>24h VOL</dt><dd>{usd(pool.volume24hUsd)}</dd></div>
          <div><dt>TVL</dt><dd>{usd(pool.tvlUsd)}</dd></div>
          <div><dt>24h fees</dt><dd>{usd(pool.fees24hUsd)}</dd></div>
        </dl>
        <ArrowUpRight size={17} aria-hidden="true" />
      </a></li>)}</ul>}
      {busy && <p className="pool-results-message" role="status">Loading pools…</p>}
      {result && result.page < result.pages && <button type="button" className="pool-results-more" disabled={busy} onClick={() => void search(result.page + 1)}>Load more pools</button>}
      {error && !busy && <button type="button" className="pool-results-more" onClick={() => void search(result ? result.page + 1 : 1)}>Try again</button>}
    </dialog>
  </div>;
}
