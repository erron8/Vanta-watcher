"use client";
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { history, type Match } from '@/lib/history';
import { classifyPositions, labelsFor, type WalletProfile } from '@/lib/wallet-labels';

type LabelContext = { profiles: Record<string, WalletProfile>; busy: boolean; current: string; status: string; error: string; errorAddress: string; analyze: (address: string) => void; stop: () => void };
const Context = createContext<LabelContext | null>(null);
export function WalletLabelsProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, WalletProfile>>({}), [busy, setBusy] = useState(false), [current, setCurrent] = useState(''), [status, setStatus] = useState(''), [error, setError] = useState(''), [errorAddress, setErrorAddress] = useState('');
  const running = useRef(false), controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    fetch('/api/labels').then(async r => { if (!r.ok) throw new Error('Saved labels unavailable.'); return await r.json() as Record<string, WalletProfile>; }).then(data => { if (active) setProfiles(prev => ({ ...data, ...prev })); }).catch(() => { /* Individual analysis remains available if saved labels cannot load. */ });
    return () => { active = false; controller.current?.abort(); };
  }, []);
  async function analyze(address: string) {
    if (running.current) return;
    running.current = true; setBusy(true); setCurrent(address); setStatus('Loading closed positions…'); setError(''); setErrorAddress('');
    const abort = new AbortController(); controller.current = abort;
    try {
      const positions: Match[] = [];
      await history(address, abort.signal, position => { positions.push(position); }, { progress: text => { if (!abort.signal.aborted) setStatus(text); } });
      abort.signal.throwIfAborted();
      const profile = classifyPositions(positions);
      const response = await fetch('/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address, profile }), signal: abort.signal });
      if (!response.ok) throw new Error('Saving labels failed.');
      const saved = await response.json() as WalletProfile;
      setProfiles(prev => ({ ...prev, [address]: saved }));
      setStatus('Label saved.');
    } catch (cause) {
      if (!abort.signal.aborted) { setError(cause instanceof Error ? cause.message : 'Could not analyze this wallet.'); setErrorAddress(address); }
    } finally { running.current = false; setBusy(false); setCurrent(''); controller.current = null; }
  }
  return <Context.Provider value={{ profiles, busy, current, status, error, errorAddress, analyze, stop: () => controller.current?.abort() }}>{children}</Context.Provider>;
}

export function WalletPills({ address }: { address: string }) {
  const context = useContext(Context);
  if (!context) return null;
  const profile = context.profiles[address], labels = profile ? labelsFor(profile) : [];
  const title = profile ? `${profile.sampleCount}/30 most recent closed positions · Quote-only deposits: ${profile.quoteCount ?? 'unknown'} · Average hold: ${profile.avgHoldSeconds === null ? 'unknown' : (profile.avgHoldSeconds / 60).toFixed(1) + ' min'} · Maximum bin width: ${profile.maxBins ?? 'unknown'} · Checked ${new Date(profile.checkedAt).toLocaleString()}. Click to refresh.` : 'Analyze the latest 30 closed positions and save wallet labels. History loads on click.';
  const fallback = !profile ? 'Label wallet' : profile.sampleCount < 30 ? `Insufficient history · ${profile.sampleCount}/30` : profile.quoteCount === null || profile.avgHoldSeconds === null || profile.maxBins === null ? 'Incomplete metrics' : 'No matching label';
  return <span className="wallet-pills" onClick={e => e.stopPropagation()}>{(labels.length ? labels : [fallback]).map(label => <button type="button" key={label} className={`wallet-pill ${labels.includes(label) ? label.toLowerCase().replace(' ', '-') : 'unclassified'}`} title={title} aria-label={`${label} for ${address}. ${title}`} disabled={context.busy} onClick={() => context.analyze(address)}>{context.current === address ? 'Analyzing…' : label}</button>)}{context.current === address && <><span className="wallet-label-status" role="status">{context.status}</span><button type="button" className="wallet-label-stop" onClick={context.stop}>Stop</button></>}{context.errorAddress === address && <span className="wallet-label-error" role="alert" title={context.error}>{context.error}</span>}</span>;
}

export function useAutomaticLabels(address: string) {
  const context = useContext(Context);
  const profile = context?.profiles[address];
  return profile ? labelsFor(profile) : [];
}
