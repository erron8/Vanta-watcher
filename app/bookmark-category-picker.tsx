"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { categoryOptions, emptyCategories, type BookmarkCategories } from '@/lib/bookmark-categories';
import { suggestCategories, type CategoryEvidence } from '@/lib/category-analysis';
import { history, duration, type Match } from '@/lib/history';
import { useAutomaticLabels } from './wallet-labels';

const groups: { key: keyof BookmarkCategories; label: string; descriptions?: Record<string, string> }[] = [
  { key: 'deposits', label: 'How they deposit' },
  { key: 'timezone', label: 'Timezone' },
  { key: 'hold', label: 'Average position time', descriptions: { Degen: 'Degen · avg <15m', Multi: 'Multi · avg >1h' } },
  { key: 'range', label: 'Average opening range', descriptions: { Tight: 'Tight · <25 bins', Normal: 'Normal · 26–100 bins', Wide: 'Wide · >100 bins' } },
];

export function BookmarkCategoryPicker({ address, categories, onSave }: { address: string; categories: BookmarkCategories; onSave: (categories: BookmarkCategories) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BookmarkCategories>(categories);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [evidence, setEvidence] = useState<CategoryEvidence | null>(null);
  const [error, setError] = useState('');
  const wrapper = useRef<HTMLDivElement>(null);
  const analysisController = useRef<AbortController | null>(null);
  const autoLabels = useAutomaticLabels(address);
  const selected = groups.map(group => categories[group.key]).filter((label): label is NonNullable<typeof label> => !!label);
  const visible = selected.length ? selected : autoLabels;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node) && !saving && !analyzing) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving && !analyzing) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, saving, analyzing]);

  useEffect(() => () => analysisController.current?.abort(), []);

  async function analyze() {
    if (analyzing) return;
    const controller = new AbortController();
    analysisController.current = controller;
    setAnalyzing(true); setError(''); setEvidence(null); setAnalysisStatus('Loading closed positions…');
    const positions: Match[] = [];
    try {
      await history(address, controller.signal, position => positions.push(position), { progress: text => { if (!controller.signal.aborted) setAnalysisStatus(text); } });
      controller.signal.throwIfAborted();
      const result = suggestCategories(positions);
      setDraft(result.categories);
      setEvidence(result.evidence);
      setAnalysisStatus(result.evidence.positions < 30 ? `Only ${result.evidence.positions} closed positions found; 30 are needed for automatic labels.` : 'Suggestions ready. Review them before saving.');
    } catch (cause) {
      if (!controller.signal.aborted) setError((cause as Error).message || 'Could not analyze this wallet.');
      else setAnalysisStatus('Analysis stopped.');
    } finally { setAnalyzing(false); analysisController.current = null; }
  }

  async function save() {
    setSaving(true); setError('');
    try { await onSave(draft); setOpen(false); }
    catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  return <div className="bookmark-category-wrap" ref={wrapper}>
    <button type="button" className="bookmark-category-trigger" aria-label={`Set categories for ${address}`} aria-expanded={open} aria-controls={`bookmark-categories-${address}`} disabled={analyzing || saving} onClick={() => { setDraft(categories); setError(''); setEvidence(null); setAnalysisStatus(''); setOpen(value => !value); }}>
      {visible.length ? visible.map(label => <span className={`wallet-pill ${label.toLowerCase().replace(' ', '-')}`} key={label}>{label}</span>) : <span className="wallet-pill unclassified">Set categories</span>}
      {!selected.length && !!autoLabels.length && <span className="bookmark-auto-hint">Auto</span>}
      <ChevronDown size={13} aria-hidden="true" />
    </button>
    {open && <form id={`bookmark-categories-${address}`} className="bookmark-category-menu" onSubmit={event => { event.preventDefault(); void save(); }}>
      <strong>Wallet categories</strong><p>Set your own labels for this bookmark.</p>
      <div className="bookmark-analysis-controls"><Button type="button" variant="outline" disabled={saving || analyzing} onClick={() => void analyze()}>{analyzing ? 'Analyzing…' : 'Auto-analyze 30 positions'}</Button>{analyzing && <button type="button" onClick={() => analysisController.current?.abort()}>Stop</button>}</div>
      {analysisStatus && <span className="bookmark-analysis-status" role="status">{analysisStatus}</span>}
      {evidence && <div className="bookmark-analysis-evidence"><span>Deposits: {evidence.deposits.quoteOnly} quote · {evidence.deposits.doubleSided} double · {evidence.deposits.baseOnly} base-only · {evidence.deposits.unknown} unknown</span><span>Average hold: {evidence.averageHoldSeconds === null ? 'unknown' : duration(evidence.averageHoldSeconds)} · Average range: {evidence.averageBins === null ? 'unknown' : evidence.averageBins.toFixed(1) + ' bins'}</span><span>Opening hours: {evidence.openingSessions.Asia} Asia · {evidence.openingSessions.London} London · {evidence.openingSessions.NYC} NYC</span><small>“Meme only” means base-only deposits paired with SOL or USDC; it does not verify the token is a meme. Timezone estimates opening hours, not location.</small></div>}
      {groups.map(group => <label key={group.key}>{group.label}<select value={draft[group.key] || ''} disabled={saving || analyzing} onChange={event => setDraft(previous => ({ ...previous, [group.key]: event.target.value || null }) as BookmarkCategories)}><option value="">Not set</option>{categoryOptions[group.key].map(option => <option value={option} key={option}>{group.descriptions?.[option] || option}</option>)}</select></label>)}
      {error && <span className="bookmark-category-error" role="alert">{error}</span>}
      <div className="bookmark-category-actions"><Button type="button" variant="outline" disabled={saving || analyzing} onClick={() => setDraft({ ...emptyCategories })}>Clear</Button><Button type="submit" disabled={saving || analyzing}>{saving ? 'Saving…' : 'Save categories'}</Button></div>
    </form>}
  </div>;
}
