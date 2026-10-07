"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- Vinext client-side Link navigation fails in this deployment. */

import { Copy, Star, Check, Layers3, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { WalletPills } from './wallet-labels';

export type Currency = "USD" | "SOL";
export type Day = { date_time: string; pnl_usd: string; pnl_sol?: string; deposit_usd?: string; deposit_sol?: string; withdrawn_usd?: string; withdrawn_sol?: string; fees_earned_usd?: string; fees_earned_sol?: string; closed_position_count?: number; win_rate_usd?: string; win_rate_sol?: string };
export type Row = { address: string; activities: number; avgInvested: number | null; avgInvestedSol?: number | null; pnl30d: number | null; pnl30dSol?: number | null; activeDays: number | null; maxLoss: number | null; monthlyProfit: number | null; calendar: Day[]; error?: string };
export const number = (v: unknown): number | null => v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
export const money = (v: number | null | undefined, compact = false) => v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, ...(compact && Math.abs(v) >= 1000 ? { notation: "compact" as const } : {}) }).format(v);
export const amount = (v: number | null | undefined, currency: Currency, compact = false) => currency === "USD" ? money(v, compact) : v == null ? "—" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: compact ? Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 10 ? 3 : 4 : 5, ...(compact && Math.abs(v) >= 1000 ? { notation: "compact" as const } : {}) }).format(v)} SOL`;
export const dayPnl = (day: Day, currency: Currency) => number(currency === "USD" ? day.pnl_usd : day.pnl_sol);
export const monthPnl = (row: Row | null, month: string, currency: Currency) => {
  if (!row) return null;
  if (currency === "USD") return row.monthlyProfit;
  const days = row.calendar.filter(d => d.date_time.startsWith(month) && d.date_time.slice(0, 10) <= new Date().toISOString().slice(0, 10));
  return days.length && days.every(d => dayPnl(d, currency) !== null) ? days.reduce((sum, d) => sum + dayPnl(d, currency)!, 0) : null;
};
export const largestLoss = (row: Row | null, month: string, currency: Currency) => {
  if (!row) return null;
  if (currency === "USD") return row.maxLoss;
  const days = row.calendar.filter(d => d.date_time.startsWith(month) && d.date_time.slice(0, 10) <= new Date().toISOString().slice(0, 10));
  return days.length && days.every(d => dayPnl(d, currency) !== null) ? Math.max(0, ...days.map(d => -dayPnl(d, currency)!)) : null;
};
export const tone = (v: number | null | undefined) => v == null || v === 0 ? "" : v > 0 ? "positive" : "negative";
export const monthName = (month: string) => new Date(month + "-01T12:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
export const shiftMonth = (month: string, offset: number) => {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function Navigation({ active }: { active: "screener" | "bookmarks" }) {
  return <header className="app-nav"><a className="brand" href="/"><Layers3 size={25} /><span>Vanta</span></a><nav aria-label="Main navigation"><a href="/">Home</a><a href="/screener" aria-current={active === "screener" ? "page" : undefined} className={active === "screener" ? "nav-active" : ""}>Wallet screener</a><a href="/bookmarks" aria-current={active === "bookmarks" ? "page" : undefined} className={active === "bookmarks" ? "nav-active" : ""}>Bookmarks</a></nav><span className="network-label">Meteora <span> / </span> Solana</span></header>;
}

export function WalletAddress({ address, name, marked, pending, onBookmark, onError, labels }: { address: string; name?: string | null; marked: boolean; pending?: boolean; onBookmark: () => void; onError: (message: string) => void; labels?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { onError("Could not copy. Select the full address and copy it manually."); } }
  return <div className="wallet-address" onClick={e => e.stopPropagation()}>{name && <span className="wallet-alias" title={name}>{name}</span>}<a href={`https://fabriq.trade/portfolio-beta?walletAddress=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" title="Open portfolio on Fabriq">{address}</a><button className="icon-button" aria-label={`Copy ${address}`} title={copied ? "Copied" : "Copy wallet"} onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}</button><button className={`icon-button ${marked ? "bookmarked" : ""}`} disabled={pending} aria-label={`${marked ? "Remove bookmark for" : "Bookmark"} ${address}`} aria-pressed={marked} title={marked ? "Remove bookmark" : "Bookmark wallet"} onClick={onBookmark}><Star size={16} fill={marked ? "currentColor" : "none"} /></button>{labels === undefined ? <WalletPills address={address} /> : labels}</div>;
}

export function Calendar({ row, month, currency = "USD", compact = false, onDateClick, onMonthChange }: { row: Row | null; month: string; currency?: Currency; compact?: boolean; onDateClick?: (date: string) => void; onMonthChange?: (month: string) => void }) {
  const start = new Date(month + "-01T12:00:00Z");
  const length = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const offset = start.getUTCDay();
  const map = new Map(row?.calendar.filter(d => d.date_time.startsWith(month)).map(d => [Number(d.date_time.slice(8, 10)), d]));
  const today = new Date().toISOString().slice(0, 10);
  const monthly = monthPnl(row, month, currency);
  return <section className={`calendar-panel ${compact ? "compact-calendar" : ""} ${currency === "SOL" ? "sol-calendar" : ""}`} aria-label="Daily profit calendar"><div className="panel-heading"><h2>{compact ? "Daily P&L" : "Monthly P&L"}</h2><span className="currency-tag">{currency}</span></div><div className="calendar-meta"><div className="calendar-month-nav">{!compact && onMonthChange && <button type="button" aria-label="Previous month" title="Previous month" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={18} /></button>}<strong>{monthName(month)}</strong>{!compact && onMonthChange && <><button type="button" aria-label="Next month" title="Next month" disabled={month >= new Date().toISOString().slice(0, 7)} onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={18} /></button><button type="button" className="this-month-button" onClick={() => onMonthChange(new Date().toISOString().slice(0, 7))}>This month</button></>}</div><span>Monthly total <b className={tone(monthly)}>{amount(monthly, currency)}</b></span></div><div className="calendar-weekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1, inMonth = day >= 1 && day <= length;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const record = inMonth && date <= today ? map.get(day) : undefined;
    const pnl = record ? dayPnl(record, currency) : null;
    const clickable = !!row && inMonth && date <= today && !compact && !!onDateClick;
    const winRate = record ? number(currency === "USD" ? record.win_rate_usd : record.win_rate_sol) : null;
    return <button type="button" key={i} disabled={!clickable} onClick={() => onDateClick?.(date)} aria-label={clickable ? `View positions closed on ${date}` : undefined} className={`calendar-day ${clickable ? "clickable-day" : ""} ${inMonth ? "" : "outside"} ${tone(pnl)} ${date === today ? "today" : ""}`} title={inMonth ? `${date}: ${amount(pnl, currency)}${clickable ? ' · Click to load positions' : ''}` : undefined}>{inMonth && <><span className="day-number">{day}</span><strong>{pnl === null ? "" : (pnl > 0 ? "+" : "") + amount(pnl, currency, true)}</strong>{record && !compact && <small>{record.closed_position_count !== undefined ? `${record.closed_position_count} closed` : ""}{winRate !== null ? ` · ${winRate.toFixed(0)}% wins` : ""}</small>}</>}</button>;
  })}</div>{!row && <p className="calendar-empty">Select a wallet after loading your scan.</p>}</section>;
}
