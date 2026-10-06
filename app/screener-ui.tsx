"use client";

import { Copy, Star, Check, Layers3 } from "lucide-react";
import { useState } from "react";
import { WalletPills } from './wallet-labels';

export type Day = { date_time: string; pnl_usd: string; deposit_usd?: string; withdrawn_usd?: string; fees_earned_usd?: string; closed_position_count?: number; win_rate_usd?: string };
export type Row = { address: string; activities: number; avgInvested: number | null; pnl30d: number | null; activeDays: number | null; maxLoss: number | null; monthlyProfit: number | null; calendar: Day[]; error?: string };
export const number = (v: unknown): number | null => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
export const money = (v: number | null | undefined, compact = false) => v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, ...(compact && Math.abs(v) >= 1000 ? { notation: "compact" as const } : {}) }).format(v);
export const tone = (v: number | null | undefined) => v == null || v === 0 ? "" : v > 0 ? "positive" : "negative";
export const monthName = (month: string) => new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export function Navigation({ active }: { active: "screener" | "bookmarks" }) {
  return <header className="app-nav"><a className="brand" href="/"><Layers3 size={25} /><span>supir</span></a><nav aria-label="Main navigation"><a href="/" aria-current={active === "screener" ? "page" : undefined} className={active === "screener" ? "nav-active" : ""}>Wallet screener</a><a href="/bookmarks" aria-current={active === "bookmarks" ? "page" : undefined} className={active === "bookmarks" ? "nav-active" : ""}>Bookmarks</a></nav><span className="network-label">Meteora <span> / </span> Solana</span></header>;
}

export function WalletAddress({ address, name, marked, pending, onBookmark, onError }: { address: string; name?: string | null; marked: boolean; pending?: boolean; onBookmark: () => void; onError: (message: string) => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { onError("Could not copy. Select the full address and copy it manually."); } }
  return <div className="wallet-address" onClick={e => e.stopPropagation()}>{name && <span className="wallet-alias" title={name}>{name}</span>}<a href={`https://fabriq.trade/portfolio-beta?walletAddress=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" title="Open portfolio on Fabriq">{address}</a><button className="icon-button" aria-label={`Copy ${address}`} title={copied ? "Copied" : "Copy wallet"} onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}</button><button className={`icon-button ${marked ? "bookmarked" : ""}`} disabled={pending} aria-label={`${marked ? "Remove bookmark for" : "Bookmark"} ${address}`} aria-pressed={marked} title={marked ? "Remove bookmark" : "Bookmark wallet"} onClick={onBookmark}><Star size={16} fill={marked ? "currentColor" : "none"} /></button><WalletPills address={address} /></div>;
}

export function Calendar({ row, month, compact = false, onDateClick }: { row: Row | null; month: string; compact?: boolean; onDateClick?: (date: string) => void }) {
  const start = new Date(month + "-01T12:00:00Z");
  const length = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = start.getUTCDay();
  const map = new Map(row?.calendar.filter(d => d.date_time.startsWith(month)).map(d => [Number(d.date_time.slice(8, 10)), d]));
  const today = new Date().toISOString().slice(0, 10);
  return <section className={`calendar-panel ${compact ? "compact-calendar" : ""}`} aria-label="Daily profit calendar"><div className="panel-heading"><h2>{compact ? "Daily P&L" : "Monthly P&L"}</h2><span className="currency-tag">USD</span></div><div className="calendar-meta"><strong>{monthName(month)}</strong><span>Monthly total <b className={tone(row?.monthlyProfit)}>{money(row?.monthlyProfit)}</b></span></div><div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1, inMonth = day >= 1 && day <= length;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const record = inMonth && date <= today ? map.get(day) : undefined;
    const pnl = record ? number(record.pnl_usd) : null;
    const clickable = !!row && inMonth && date <= today && !compact && !!onDateClick;
    return <button type="button" key={i} disabled={!clickable} onClick={() => onDateClick?.(date)} aria-label={clickable ? `View positions closed on ${date}` : undefined} className={`calendar-day ${clickable ? "clickable-day" : ""} ${inMonth ? "" : "outside"} ${tone(pnl)} ${date === today ? "today" : ""}`} title={inMonth ? `${date}: ${money(pnl)}${clickable ? ' · Click to load positions' : ''}` : undefined}>{inMonth && <><span className="day-number">{day}</span><strong>{pnl === null ? "" : (pnl > 0 ? "+" : "") + money(pnl, true)}</strong>{record && !compact && <small>{record.closed_position_count !== undefined ? `${record.closed_position_count} closed` : ""}{number(record.win_rate_usd) !== null ? ` · ${Number(record.win_rate_usd).toFixed(0)}% wins` : ""}</small>}</>}</button>;
  })}</div>{!row && <p className="calendar-empty">Select a wallet after loading your scan.</p>}</section>;
}
