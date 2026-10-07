"use client";

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { categoryOptions, emptyCategories, type BookmarkCategories } from '@/lib/bookmark-categories';
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
  const [error, setError] = useState('');
  const wrapper = useRef<HTMLDivElement>(null);
  const autoLabels = useAutomaticLabels(address);
  const selected = groups.map(group => categories[group.key]).filter((label): label is NonNullable<typeof label> => !!label);
  const visible = selected.length ? selected : autoLabels;

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node) && !saving) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open, saving]);

  async function save() {
    setSaving(true); setError('');
    try { await onSave(draft); setOpen(false); }
    catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  return <div className="bookmark-category-wrap" ref={wrapper}>
    <button type="button" className="bookmark-category-trigger" aria-label={`Set categories for ${address}`} aria-expanded={open} aria-controls={`bookmark-categories-${address}`} onClick={() => { setDraft(categories); setError(''); setOpen(value => !value); }}>
      {visible.length ? visible.map(label => <span className={`wallet-pill ${label.toLowerCase().replace(' ', '-')}`} key={label}>{label}</span>) : <span className="wallet-pill unclassified">Set categories</span>}
      {!selected.length && !!autoLabels.length && <span className="bookmark-auto-hint">Auto</span>}
      <ChevronDown size={13} aria-hidden="true" />
    </button>
    {open && <form id={`bookmark-categories-${address}`} className="bookmark-category-menu" onSubmit={event => { event.preventDefault(); void save(); }}>
      <strong>Wallet categories</strong><p>Set your own labels for this bookmark.</p>
      {groups.map(group => <label key={group.key}>{group.label}<select value={draft[group.key] || ''} disabled={saving} onChange={event => setDraft(previous => ({ ...previous, [group.key]: event.target.value || null }) as BookmarkCategories)}><option value="">Not set</option>{categoryOptions[group.key].map(option => <option value={option} key={option}>{group.descriptions?.[option] || option}</option>)}</select></label>)}
      {error && <span className="bookmark-category-error" role="alert">{error}</span>}
      <div className="bookmark-category-actions"><Button type="button" variant="outline" disabled={saving} onClick={() => setDraft({ ...emptyCategories })}>Clear</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save categories'}</Button></div>
    </form>}
  </div>;
}
