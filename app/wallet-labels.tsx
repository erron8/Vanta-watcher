"use client";
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { history, type Match } from '@/lib/history';
import { classifyPositions, labelsFor, type WalletProfile } from '@/lib/wallet-labels';
import { Button } from '@/components/ui/button';

type LabelContext = { profiles: Record<string, WalletProfile>; busy: boolean; current: string; status: string; error: string; analyze: (addresses: string[]) => void; stop: () => void };
const Context = createContext<LabelContext | null>(null);
export function WalletLabelsProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, WalletProfile>>({}), [busy, setBusy] = useState(false), [current, setCurrent] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState('');
  const running = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/labels').then(async r => { if (!r.ok) throw new Error('Saved labels unavailable.'); return await r.json() as Record<string, WalletProfile>; }).then(data => { if (active) setProfiles(prev => ({ ...data, ...prev })); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; controller.current?.abort(); };
  }, []);
  async function analyze(addresses: string[]) {
    if (running.current) return;
    running.current = true; setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    const unique = [...new Set(addresses)]; let done = 0, failed = 0;
    try {
      for (const address of unique) {
        if (abort.signal.aborted) break;
        setCurrent(address); setStatus(`Labeling ${done + failed + 1} / ${unique.length} wallets…`);
        try {
          const positions: Match[] = [];
          await history(address, abort.signal, p => { positions.push(p); }, { progress: text => { if (!abort.signal.aborted) setStatus(`Wallet ${done + failed + 1} / ${unique.length} · ${text}`); } });
          abort.signal.throwIfAborted();
          const profile = classifyPositions(positions);
          const response = await fetch('/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, profile }), signal: abort.signal });
          if (!response.ok) throw new Error('Saving labels failed');
          const saved = await response.json() as WalletProfile;
          setProfiles(prev => ({ ...prev, [address]: saved })); done++;
        } catch { if (!abort.signal.aborted) failed++; }
      }
      setStatus(`${abort.signal.aborted ? 'Stopped' : 'Labels saved'} · ${done} / ${unique.length} wallets updated`);
      if (failed) setError(`${failed} wallets could not be fully analyzed or saved. Existing labels were kept; click a pill to retry.`);
    } finally { running.current = false; setBusy(false); setCurrent(''); }
  }
  return <Context.Provider value={{ profiles, busy, current, status, error, analyze, stop: () => controller.current?.abort() }}>{children}</Context.Provider>;
}

export function WalletPills({ address }: { address: string }) {
  const context = useContext(Context);
  if (!context) return null;
  const profile = context.profiles[address], labels = profile ? labelsFor(profile) : [];
  const title = profile ? `${profile.sampleCount}/30 most recent closed positions · Quote-only deposits: ${profile.quoteCount ?? 'unknown'} · Average hold: ${profile.avgHoldSeconds === null ? 'unknown' : (profile.avgHoldSeconds / 60).toFixed(1) + ' min'} · Maximum bin width: ${profile.maxBins ?? 'unknown'} · Checked ${new Date(profile.checkedAt).toLocaleString()}. Click to refresh.` : 'Analyze the latest 30 closed positions and save wallet labels. History loads on click.';
  const fallback = !profile ? 'Label wallet' : profile.sampleCount < 30 ? `Insufficient history · ${profile.sampleCount}/30` : profile.quoteCount === null || profile.avgHoldSeconds === null || profile.maxBins === null ? 'Incomplete metrics' : 'No matching label';
  return <span className="wallet-pills" onClick={e => e.stopPropagation()}>{(labels.length ? labels : [fallback]).map(label => <button type="button" key={label} className={`wallet-pill ${labels.includes(label) ? label.toLowerCase().replace(' ', '-') : 'unclassified'}`} title={title} aria-label={`${label} for ${address}. ${title}`} disabled={context.busy} onClick={() => context.analyze([address])}>{context.current === address ? 'Analyzing…' : label}</button>)}</span>;
}

export function LabelControls({ addresses, disabled = false }: { addresses: string[]; disabled?: boolean }) {
  const context = useContext(Context);
  if (!context) return null;
  return <div className="label-controls"><Button variant="outline" disabled={disabled || context.busy || !addresses.length} onClick={() => context.analyze(addresses)}>Label wallets ({addresses.length})</Button>{context.busy && <Button variant="outline" onClick={context.stop}>Stop labeling</Button>}<span role="status">{context.status || 'Latest 30 closed positions · Quote only: ≥16 SOL/USDC-only deposits · Multi: avg >1h · Degen: avg <15m, max 30 bins'}</span>{context.error && <span className="negative" role="alert">{context.error}</span>}</div>;
}
