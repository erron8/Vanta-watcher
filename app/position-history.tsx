"use client";
import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { history, matches, duration, type Match } from '@/lib/history';
import { amount, number, tone, type Currency } from './screener-ui';
import { WalletPills } from './wallet-labels';
import { clearSessionCache } from '@/lib/session-cache';

function Positions({ positions, currency = "USD", bookmarks, bookmarkNames, onBookmark, onSelectWallet }: { positions: Match[]; currency?: Currency; bookmarks?: Set<string>; bookmarkNames?: Record<string, string>; onBookmark?: (address: string) => void; onSelectWallet?: (address: string) => void }) {
  return <div className="wallet-table-scroll"><table className="wallet-table position-table"><thead><tr><th>Wallet / position</th><th>Pool</th><th>Deposited ({currency})</th><th>P&L ({currency})</th><th>Return ({currency})</th><th>Held</th><th>Closed (UTC)</th></tr></thead><tbody>{positions.map(p => {
    const pnl = number(currency === "USD" ? p.pnlUsd : p.pnlSol);
    const pct = number(currency === "USD" ? p.pnlPctChange : p.pnlSolPctChange);
    return <tr key={p.wallet + p.positionAddress}><td><div className="candidate-wallet-line">{onSelectWallet ? <button type="button" className="history-wallet history-wallet-button" title="Show wallet overview" onClick={() => onSelectWallet(p.wallet)}>{bookmarkNames?.[p.wallet] || p.wallet}</button> : <a className="history-wallet" href={`https://fabriq.trade/portfolio-beta?walletAddress=${p.wallet}`} target="_blank" rel="noreferrer">{bookmarkNames?.[p.wallet] || p.wallet}</a>}{onBookmark && <button type="button" className={`icon-button candidate-bookmark${bookmarks?.has(p.wallet) ? ' bookmarked' : ''}`} title={bookmarks?.has(p.wallet) ? 'Rename bookmarked wallet' : 'Bookmark wallet'} aria-label={`${bookmarks?.has(p.wallet) ? 'Rename bookmark for' : 'Bookmark'} ${p.wallet}`} onClick={() => onBookmark(p.wallet)}><Star size={16} fill={bookmarks?.has(p.wallet) ? 'currentColor' : 'none'} /></button>}</div>{bookmarkNames?.[p.wallet] && <span className="candidate-wallet-address">{p.wallet}</span>}<WalletPills address={p.wallet} /><details><summary>Position details</summary><div className="position-details"><span>{p.positionAddress}</span><span>Opened: {new Date(p.createdAt * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC</span><span>Withdrawn: {amount(number(currency === "USD" ? p.allTimeWithdrawals?.total?.usd : p.allTimeWithdrawals?.total?.sol), currency)}</span><span>Fees: {amount(number(currency === "USD" ? p.allTimeFees?.total?.usd : p.allTimeFees?.total?.sol), currency)}</span><span>Pool: {p.pool.poolAddress}</span><span>Bin step {p.pool.binStep} · Base fee {p.pool.baseFee}%</span></div></details></td><td>{p.pool.tokenX}–{p.pool.tokenY}</td><td>{amount(number(currency === "USD" ? p.allTimeDeposits?.total?.usd : p.allTimeDeposits?.total?.sol), currency)}</td><td className={tone(pnl)}>{amount(pnl, currency)}</td><td className={tone(pct)}>{pct?.toFixed(2) ?? '—'}%</td><td>{duration(p.closedAt - p.createdAt)}</td><td>{new Date(p.closedAt * 1000).toISOString().replace('T', ' ').slice(0, 19)}</td></tr>;
  })}</tbody></table></div>;
}

export function DayPositions({ wallet, date, currency, close }: { wallet: string; date: string; currency: Currency; close: () => void }) {
  const [positions, setPositions] = useState<Match[]>([]), [status, setStatus] = useState('Loading history…'), [error, setError] = useState(''), [busy, setBusy] = useState(true), [retry, setRetry] = useState(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); abort.current = controller;
    const found: Match[] = [];
    history(wallet, controller.signal, p => { found.push(p); }, { date, progress: text => { if (!controller.signal.aborted) setStatus(text); } })
      .then(() => { if (!controller.signal.aborted) setStatus(`${found.length} closed positions`); })
      .catch(e => { if (!controller.signal.aborted) { setError(e.message); setStatus('Incomplete history — showing positions retrieved so far.'); } })
      .finally(() => { if (!controller.signal.aborted) { setPositions(found.sort((a, b) => b.closedAt - a.closedAt)); setBusy(false); } });
    return () => controller.abort();
  }, [wallet, date, retry]);
  return <section className="history-panel"><div className="panel-heading"><h2>Closed positions · {date} <span className="currency-tag">UTC</span></h2><Button variant="outline" onClick={close}>{busy ? 'Cancel & close' : 'Close'}</Button></div><p className="panel-note">{wallet} · Positions are grouped by their closing date. Calendar totals may include other activity.</p><p className="history-status" role="status">{status}</p>{error && <div className="error-banner" role="alert">{error}<button onClick={() => { setBusy(true); setError(''); setPositions([]); setRetry(n => n + 1); }}>Retry</button></div>}{positions.length > 0 && <Positions positions={positions} currency={currency} />}{!busy && !error && !positions.length && <p className="panel-note">No closed DLMM positions found for this UTC date.</p>}</section>;
}

export function WalletFinder({ wallets, disabled, bookmarks, bookmarkNames, onBookmarked, onSelectWallet }: { wallets: string[]; disabled: boolean; bookmarks: Set<string>; bookmarkNames: Record<string, string>; onBookmarked: (address: string, name: string) => void; onSelectWallet: (address: string) => void }) {
  const [fields, setFields] = useState({ tvl: '', tolerance: '10', pnl: '', pnlTolerance: '2', held: '', secondsTolerance: '60', pair: '', date: '' });
  const [positions, setPositions] = useState<Match[]>([]), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [error, setError] = useState('');
  const [bookmarkAddress, setBookmarkAddress] = useState<string | null>(null), [bookmarkName, setBookmarkName] = useState(''), [bookmarkError, setBookmarkError] = useState(''), [savingBookmark, setSavingBookmark] = useState(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function search() {
    if (busy) return;
    const parts = fields.held.split(':').map(Number);
    if (fields.held && (!/^\d+:\d{2}:\d{2}$/.test(fields.held) || parts[1] > 59 || parts[2] > 59)) { setError('Use HH:MM:SS for holding duration.'); return; }
    const controller = new AbortController(); abort.current = controller;
    setBusy(true); setPositions([]); setError(''); setStatus('Loading position history…');
    const target = { tvl: Number(fields.tvl), tolerance: Number(fields.tolerance), pnl: fields.pnl === '' ? undefined : Number(fields.pnl), pnlTolerance: Number(fields.pnlTolerance), seconds: fields.held ? parts[0] * 3600 + parts[1] * 60 + parts[2] : undefined, secondsTolerance: Number(fields.secondsTolerance) };
    const queue = [...new Set(wallets)], found: Match[] = []; let done = 0, failed = 0;
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length && !controller.signal.aborted) {
        const wallet = queue.shift()!;
        try { await history(wallet, controller.signal, p => { if (matches(p, target)) { found.push(p); setPositions([...found].sort((a, b) => Math.abs(Number(a.allTimeDeposits.total.usd) - target.tvl) - Math.abs(Number(b.allTimeDeposits.total.usd) - target.tvl))); } }, { date: fields.date, pair: fields.pair.trim() }); }
        catch { if (!controller.signal.aborted) failed++; }
        if (!controller.signal.aborted) setStatus(`${++done} / ${wallets.length} wallets checked · ${found.length} matching positions`);
      }
    }));
    setStatus(`${controller.signal.aborted ? 'Stopped · partial results' : 'Search complete'} · ${done} / ${wallets.length} wallets checked · ${new Set(found.map(p => p.wallet)).size} candidate wallets · ${found.length} positions`);
    if (failed) setError(`${failed} wallets could not be fully checked. Search again to retry; successful pages are cached for 5 minutes.`);
    setBusy(false);
  }
  const field = (key: keyof typeof fields, label: string, type = 'number', placeholder?: string) => <label>{label}<Input type={type} min={key === 'pnl' || type !== 'number' ? undefined : 0} step={type === 'number' ? 'any' : undefined} required={key === 'tvl' || key.endsWith('Tolerance') || key === 'tolerance'} value={fields[key]} placeholder={placeholder} disabled={busy} onChange={e => setFields({ ...fields, [key]: e.target.value })} /></label>;
  async function saveBookmark() {
    if (!bookmarkAddress || savingBookmark) return;
    const name = bookmarkName.trim();
    if (!name) { setBookmarkError('Enter a name for this wallet.'); return; }
    setSavingBookmark(true); setBookmarkError('');
    try {
      const add = await fetch('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: bookmarkAddress }) });
      if (!add.ok) throw new Error((await add.json() as { error?: string }).error || 'Could not bookmark the wallet.');
      const rename = await fetch('/api/bookmarks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: bookmarkAddress, name }) });
      if (!rename.ok) throw new Error((await rename.json() as { error?: string }).error || 'Could not save the wallet name.');
      clearSessionCache('vanta:bookmarks:v1');
      onBookmarked(bookmarkAddress, name);
      setBookmarkAddress(null);
    } catch (e) { setBookmarkError((e as Error).message); }
    finally { setSavingBookmark(false); }
  }
  return <section className="history-panel"><div className="panel-heading"><h2>Find a wallet by position</h2><Button variant="outline" disabled={busy} onClick={() => setFields({ tvl: '567', tolerance: '10', pnl: '203', pnlTolerance: '2', held: '00:23:55', secondsTolerance: '60', pair: 'BIDDY-SOL', date: '' })}>Use screenshot example</Button></div><p className="panel-note">Search {wallets.length} imported wallets. TVL is compared with total position deposits in USD; time means holding duration. Matches are candidates, not confirmed identities. History loads only when you search.</p><form onSubmit={e => { e.preventDefault(); void search(); }}><div className="finder-fields">{field('tvl', 'TVL / invested ($)', 'number', '567')}{field('pnl', 'Position profit ($)', 'number', 'Optional')}{field('held', 'Holding duration', 'text', 'HH:MM:SS')}{field('pair', 'Pair contains', 'text', 'e.g. BIDDY-SOL')}{field('date', 'Closed on (UTC)', 'date')}</div><details className="tolerance-options"><summary>Match tolerances</summary><div className="finder-fields">{field('tolerance', 'TVL ± USD')}{field('pnlTolerance', 'Profit ± USD')}{field('secondsTolerance', 'Duration ± seconds')}</div></details><div className="finder-actions"><Button type="submit" disabled={busy || disabled || !wallets.length}>Find candidate wallets</Button>{busy && <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>Stop search</Button>}<span role="status">{status}</span></div></form>{error && <p className="error-banner" role="alert">{error}</p>}{positions.length > 0 && <Positions positions={positions} bookmarks={bookmarks} bookmarkNames={bookmarkNames} onSelectWallet={onSelectWallet} onBookmark={address => { setBookmarkAddress(address); setBookmarkName(bookmarkNames[address] || ''); setBookmarkError(''); }} />}{status.startsWith('Search complete') && !positions.length && <p className="panel-note">No matching positions in the checked history. Try wider tolerances or remove the pair/date restriction.</p>}{bookmarkAddress && <div className="bookmark-dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !savingBookmark) setBookmarkAddress(null); }}><div className="bookmark-dialog" role="dialog" aria-modal="true" aria-labelledby="bookmark-dialog-title" onKeyDown={e => { if (e.key === 'Escape' && !savingBookmark) setBookmarkAddress(null); }}><h2 id="bookmark-dialog-title">{bookmarks.has(bookmarkAddress) ? 'Rename bookmarked wallet' : 'Bookmark wallet'}</h2><p className="bookmark-dialog-address">{bookmarkAddress}</p><form onSubmit={e => { e.preventDefault(); void saveBookmark(); }}><label htmlFor="candidate-bookmark-name">Wallet name</label><Input id="candidate-bookmark-name" autoFocus maxLength={80} value={bookmarkName} onChange={e => setBookmarkName(e.target.value)} placeholder="e.g. SOL trader" disabled={savingBookmark} />{bookmarkError && <p className="bookmark-dialog-error" role="alert">{bookmarkError}</p>}<div className="bookmark-dialog-actions"><Button type="button" variant="outline" disabled={savingBookmark} onClick={() => setBookmarkAddress(null)}>Cancel</Button><Button type="submit" disabled={savingBookmark}>{savingBookmark ? 'Saving…' : 'Save bookmark'}</Button></div></form></div></div>}</section>;
}
