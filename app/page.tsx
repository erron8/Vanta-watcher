"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Download, FileSpreadsheet, Loader2, RotateCcw, SlidersHorizontal, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Navigation, WalletAddress, money, number, tone, monthName, type Row, type Day } from "./screener-ui";
import { DayPositions, WalletFinder } from "./position-history";
import { reserveRequest } from "@/lib/history";

type Sort = "address" | "activities" | "avgInvested" | "pnl30d" | "activeDays" | "maxLoss" | "monthlyProfit";
type Filters = { invested: string; days: string; loss: string; minProfit: string; maxProfit: string };
const emptyFilters: Filters = { invested: "", days: "", loss: "", minProfit: "", maxProfit: "" };
const headings: [string, Sort][] = [["Wallet", "address"], ["Activities", "activities"], ["Avg. invested", "avgInvested"], ["30d P&L", "pnl30d"], ["Active days", "activeDays"], ["Max daily loss", "maxLoss"], ["Monthly profit", "monthlyProfit"]];
const filterLabels: [keyof Filters, string, string][] = [["invested", "Min. avg. invested", "USD"], ["days", "Min. active days", "Days"], ["loss", "Max. daily loss", "USD"], ["minProfit", "Min. monthly profit", "USD"], ["maxProfit", "Max. monthly profit", "USD"]];

function parseCSV(text: string) {
  const rows: string[][] = []; let row: string[] = [], value = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === "," && !quoted) { row.push(value); value = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && text[i + 1] === "\n") i++; row.push(value); if (row.some(x => x.trim())) rows.push(row); row = []; value = ""; }
    else value += c;
  }
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(value); if (row.some(x => x.trim())) rows.push(row);
  return rows;
}

export default function Home() {
  const [wallets, setWallets] = useState<{ address: string; activities: number }[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("Loading saved scan…");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(true);
  const [selected, setSelected] = useState("");
  const [historyDay, setHistoryDay] = useState<{ wallet: string; date: string } | null>(null);
  const [hover, setHover] = useState<{ row: Row; x: number; y: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [bookmarkPending, setBookmarkPending] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>("monthlyProfit");
  const [direction, setDirection] = useState(-1);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const fileInput = useRef<HTMLInputElement>(null);
  const scanLock = useRef(false);

  useEffect(() => {
    fetch("/api/scans").then(async r => { if (!r.ok) throw new Error("Could not load the saved scan."); return r.json() as Promise<{ scan: { month: string; sourceName: string; walletCount: number; createdAt: string } | null; rows: Row[] }>; }).then(data => {
      if (data.scan) {
        setRows(data.rows); setMonth(data.scan.month); setSource(data.scan.sourceName);
        setWallets(data.rows.map((r: Row) => ({ address: r.address, activities: r.activities })));
        setStatus(data.scan.walletCount + " wallets · Saved " + new Date(data.scan.createdAt).toLocaleString());
      } else setStatus("Upload an activity CSV to start.");
    }).catch(e => { setProblem(e.message); setStatus("Saved scan unavailable."); });
    fetch("/api/bookmarks").then(async r => { if (!r.ok) throw new Error("Could not load bookmarks."); return r.json() as Promise<{ address: string }[]>; })
      .then(data => setBookmarks(new Set(data.map((r: { address: string }) => r.address)))).catch(e => setProblem(e.message));
  }, []);

  useEffect(() => {
    const hide = () => setHover(null);
    window.addEventListener("scroll", hide, true); window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, []);

  const shown = useMemo(() => rows.filter(r => {
    if (r.error) return false;
    return (filters.invested === "" || r.avgInvested !== null && r.avgInvested >= Number(filters.invested))
      && (filters.days === "" || r.activeDays !== null && r.activeDays >= Number(filters.days))
      && (filters.loss === "" || r.maxLoss !== null && r.maxLoss <= Number(filters.loss))
      && (filters.minProfit === "" || r.monthlyProfit !== null && r.monthlyProfit >= Number(filters.minProfit))
      && (filters.maxProfit === "" || r.monthlyProfit !== null && r.monthlyProfit <= Number(filters.maxProfit));
  }).sort((a, b) => {
    const x = a[sort], y = b[sort];
    if (x === null && y === null) return 0; if (x === null) return 1; if (y === null) return -1;
    return (typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y)) * direction;
  }), [rows, filters, sort, direction]);

  const focus = shown.find(r => r.address === selected) || shown[0] || null;
  const failed = rows.filter(r => r.error).length;
  const today = new Date().toISOString().slice(0, 10);
  const daily = focus?.calendar.filter(d => d.date_time.startsWith(month) && d.date_time.slice(0, 10) <= today) || [];
  const winning = daily.filter(d => Number(d.pnl_usd) > 0).length;
  const losing = daily.filter(d => Number(d.pnl_usd) < 0).length;
  const dayWin = winning + losing ? winning / (winning + losing) * 100 : null;
  const values = daily.map(d => number(d.pnl_usd)).filter((n): n is number => n !== null);
  const deposits = daily.reduce((s, d) => s + (number(d.deposit_usd) || 0), 0);
  const withdrawn = daily.reduce((s, d) => s + (number(d.withdrawn_usd) || 0), 0);

  async function upload(file?: File) {
    if (!file || scanLock.current) return;
    try {
      const data = parseCSV(await file.text()), index = data[0]?.findIndex(h => h.trim().toLowerCase() === "from");
      if (index === undefined || index < 0) throw new Error("The CSV must contain a From column.");
      const counts = new Map<string, number>();
      data.slice(1).forEach(r => { const address = (r[index] || "").trim(); if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) counts.set(address, (counts.get(address) || 0) + 1); });
      if (!counts.size) throw new Error("No valid wallet addresses found.");
      if (counts.size > 2000) throw new Error("Use a CSV with up to 2,000 unique wallets.");
      setWallets([...counts].map(([address, activities]) => ({ address, activities })));
      setSource(file.name); setRows([]); setSelected(""); setHover(null); setProblem(""); setSaved(true);
      setStatus(counts.size + " unique wallets extracted. Ready to scan.");
    } catch (e) { setProblem((e as Error).message); }
  }

  async function save(data: Row[]) {
    const r = await fetch("/api/scans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceName: source, month, rows: data.map(row => ({ ...row, maxProfit: null })) }) });
    if (!r.ok) throw new Error("The scan is downloaded but could not be saved. Use Retry save.");
    setSaved(true);
  }

  async function scan() {
    if (!wallets.length || scanLock.current || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
    scanLock.current = true; setBusy(true); setProblem(""); setHover(null);
    const queue = [...wallets], output: Row[] = []; let done = 0;
    async function get(url: string) {
      for (let attempt = 0; attempt < 3; attempt++) {
        await reserveRequest();
        const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if ((response.status === 429 || response.status >= 500) && attempt < 2) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
        if (!response.ok) throw new Error("Meteora returned " + response.status);
        return response.json() as Promise<{ data_points?: Day[]; avg_invested_usd?: string; pnl_usd?: string }>;
      }
    }
    async function worker() {
      while (queue.length) {
        const wallet = queue.shift()!;
        try {
          const base = "https://portfolio.datapi.meteora.ag", a = encodeURIComponent(wallet.address);
          const [p, c] = await Promise.all([get(base + "/performances/" + a + "?time_range=30d"), get(base + "/chart/calendar/" + a + "?month=" + month)]);
          if (!c || !p || !Array.isArray(c.data_points) || p.avg_invested_usd === undefined) throw new Error("Incomplete API response");
          const calendar: Day[] = c.data_points;
          const days = calendar.filter(d => d.date_time.startsWith(month) && d.date_time.slice(0, 10) <= today);
          const valid = days.length > 0 && days.every(d => number(d.pnl_usd) !== null);
          const pnl = days.map(d => Number(d.pnl_usd));
          output.push({ ...wallet, avgInvested: number(p.avg_invested_usd), pnl30d: number(p.pnl_usd),
            activeDays: valid ? days.filter(d => [d.pnl_usd, d.deposit_usd, d.withdrawn_usd, d.fees_earned_usd, d.closed_position_count].some(v => (number(v) || 0) !== 0)).length : null,
            maxLoss: valid ? Math.max(0, ...pnl.map(v => -v)) : null, monthlyProfit: valid ? pnl.reduce((a, b) => a + b, 0) : null, calendar });
        } catch (e) { output.push({ ...wallet, avgInvested: null, pnl30d: null, activeDays: null, maxLoss: null, monthlyProfit: null, calendar: [], error: (e as Error).message }); }
        done++; setStatus("Downloading " + done + " / " + wallets.length + " wallets");
      }
    }
    try {
      await Promise.all(Array.from({ length: Math.min(12, wallets.length) }, worker));
      setRows(output); setSaved(false); setStatus("Saving scan…"); await save(output);
      const errors = output.filter(r => r.error).length;
      setStatus("Saved " + output.length + " wallets" + (errors ? " · " + errors + " unavailable" : "") + " · Filters use downloaded data");
    } catch (e) { setProblem((e as Error).message); setStatus("Download complete."); }
    finally { scanLock.current = false; setBusy(false); }
  }

  async function bookmark(address: string) {
    if (bookmarkPending.has(address)) return;
    const remove = bookmarks.has(address);
    setBookmarkPending(prev => new Set(prev).add(address));
    try {
      const response = await fetch("/api/bookmarks", { method: remove ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) });
      if (!response.ok) throw new Error("Could not update the bookmark.");
      setBookmarks(prev => { const next = new Set(prev); if (remove) next.delete(address); else next.add(address); return next; });
    } catch (e) { setProblem((e as Error).message); }
    finally { setBookmarkPending(prev => { const next = new Set(prev); next.delete(address); return next; }); }
  }

  function download() {
    const data = ["address,activities,avg_invested_usd,pnl_30d_usd,active_days,max_daily_loss_usd,monthly_profit_usd", ...shown.map(r => [r.address, r.activities, r.avgInvested, r.pnl30d, r.activeDays, r.maxLoss, r.monthlyProfit].join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([data], { type: "text/csv" })), a = document.createElement("a"); a.href = url; a.download = "wallets-" + month + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className="terminal"><Navigation active="screener" />
    <div className="import-bar" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void upload(e.dataTransfer.files[0]); }}>
      <div className="source-label"><FileSpreadsheet size={17} /><span title={source}>{source || "No activity CSV loaded"}</span>{wallets.length > 0 && <span className="count-badge">{wallets.length} wallets</span>}</div>
      <div className="toolbar-actions"><label className="month-control"><CalendarDays size={16} /><input type="month" aria-label="Calendar month" value={month} disabled={busy} onChange={e => { if (e.target.value) { setMonth(e.target.value); setRows([]); setSelected(""); setHover(null); setSaved(true); setStatus("Month changed. Download data for the selected month."); } }} /></label>
        <input ref={fileInput} className="sr-only" type="file" accept=".csv,text/csv" aria-label="Upload activity CSV" onChange={e => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
        <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}><Upload size={15} />Import CSV</Button>
        <Button disabled={!wallets.length || busy} onClick={scan}>{busy ? <Loader2 size={15} className="spin" /> : <Download size={15} />}{busy ? "Scanning…" : rows.length ? "Refresh scan" : "Scan wallets"}</Button></div>
    </div>
    <div className="section-tabs"><span className="tab-current">Overview</span><span className="muted">USD</span><span className="status-text" role="status">{status}</span></div>
    {problem && <div className="error-banner" role="alert">{problem}{!saved && <button onClick={() => { void save(rows).then(() => { setProblem(""); setStatus("Scan saved."); }).catch(e => setProblem(e.message)); }}>Retry save</button>}</div>}
    <div className="dashboard-content">
      <div className="overview-label"><h1>Wallet overview</h1><span>{focus ? focus.address : "Select a wallet to inspect its performance"}</span><span className="overview-month">{monthName(month)}</span></div>
      <section className="metrics-strip" aria-label="Selected wallet metrics">
        <div className="metric-card"><span>Monthly P&L</span><strong className={tone(focus?.monthlyProfit)}>{money(focus?.monthlyProfit)}</strong><small>Calendar month · USD</small></div>
        <div className="metric-card"><span>Profitable days</span><strong>{dayWin === null ? "—" : dayWin.toFixed(1) + "%"}</strong><div className="win-bar"><i style={{ width: (dayWin || 0) + "%" }} /></div><small><b className="positive">{winning} win</b><span> / </span><b className="negative">{losing} loss</b></small></div>
        <div className="metric-card"><span>Average invested</span><strong>{money(focus?.avgInvested)}</strong><small>Rolling 30 days</small></div>
        <div className="metric-card"><span>Active days</span><strong>{focus?.activeDays ?? "—"}</strong><small>Activity in the selected month</small></div>
        <div className="metric-card"><span>Largest daily loss</span><strong className={focus?.maxLoss ? "negative" : ""}>{money(focus?.maxLoss ? -focus.maxLoss : focus?.maxLoss)}</strong><small>Calendar month · USD</small></div>
      </section>
      <section className="overview-grid"><div className="performance-panel"><div className="panel-heading"><h2>Performance</h2><Wallet size={17} /></div>
        <dl><div><dt>30-day P&L</dt><dd className={tone(focus?.pnl30d)}>{money(focus?.pnl30d)}</dd></div><div><dt>CSV activities</dt><dd>{focus?.activities ?? "—"}</dd></div><div><dt>Monthly deposits</dt><dd>{focus ? money(deposits) : "—"}</dd></div><div><dt>Monthly withdrawals</dt><dd>{focus ? money(withdrawn) : "—"}</dd></div><div><dt>Best day</dt><dd className={tone(values.length ? Math.max(...values) : null)}>{values.length ? money(Math.max(...values)) : "—"}</dd></div><div><dt>Worst day</dt><dd className={tone(values.length ? Math.min(...values) : null)}>{values.length ? money(Math.min(...values)) : "—"}</dd></div></dl>
        <div className="profit-summary"><span>Monthly profit</span><strong className={tone(focus?.monthlyProfit)}>{money(focus?.monthlyProfit)}</strong></div><p className="panel-note">Click a table row to inspect a wallet. Hover for a quick calendar preview.</p>
      </div><Calendar row={focus} month={month} onDateClick={date => { if (focus) setHistoryDay({ wallet: focus.address, date }); }} /></section>
      {historyDay && <DayPositions key={historyDay.wallet + historyDay.date} wallet={historyDay.wallet} date={historyDay.date} close={() => setHistoryDay(null)} />}
      <WalletFinder key={source + wallets.map(w => w.address).join(',')} wallets={wallets.map(w => w.address)} disabled={busy} />
      <section className="wallet-section"><div className="panel-heading"><h2>Wallets <span className="count-badge">{shown.length}</span></h2><div className="toolbar-actions">{failed > 0 && <span className="negative">{failed} unavailable</span>}<Button variant="outline" disabled={!shown.length} onClick={download}><Download size={14} />Export</Button></div></div>
        <div className="filters"><SlidersHorizontal size={17} className="filter-icon" />{filterLabels.map(([key, label, unit]) => <label key={key}>{label}<div className="filter-input"><Input type="number" min={key === "minProfit" || key === "maxProfit" ? undefined : 0} placeholder="Any" value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })} /><span>{unit}</span></div></label>)}<button className="icon-button reset-filters" title="Reset filters" aria-label="Reset filters" onClick={() => setFilters(emptyFilters)}><RotateCcw size={16} /></button></div>
        <div className="wallet-table-scroll"><table className="wallet-table"><thead><tr>{headings.map(([label, key]) => <th key={key} aria-sort={sort === key ? direction === 1 ? "ascending" : "descending" : "none"}><button onClick={() => { setSort(key); setDirection(sort === key ? -direction : key === "address" ? 1 : -1); }}>{label}{sort === key ? direction === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={12} />}</button></th>)}</tr></thead><tbody>{shown.map(row => <tr key={row.address} className={focus?.address === row.address ? "selected-row" : ""} tabIndex={0} onFocus={() => setSelected(row.address)} onClick={() => setSelected(row.address)} onKeyDown={e => { if (e.key === "Enter") setSelected(row.address); }} onMouseEnter={e => setHover({ row, x: e.clientX, y: e.clientY })} onMouseMove={e => setHover({ row, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHover(null)}>
          <td><WalletAddress address={row.address} marked={bookmarks.has(row.address)} pending={bookmarkPending.has(row.address)} onBookmark={() => bookmark(row.address)} onError={setProblem} /></td><td>{row.activities}</td><td>{money(row.avgInvested)}</td><td className={tone(row.pnl30d)}>{money(row.pnl30d)}</td><td>{row.activeDays ?? "—"}</td><td className={row.maxLoss ? "negative" : ""}>{money(row.maxLoss ? -row.maxLoss : row.maxLoss)}</td><td className={tone(row.monthlyProfit)}>{money(row.monthlyProfit)}</td>
        </tr>)}{!shown.length && <tr><td colSpan={7} className="empty-table"><FileSpreadsheet size={24} /><strong>{rows.length ? "No wallets match your filters" : "Your wallet scan starts here"}</strong><span>{rows.length ? "Adjust or reset the filters to see more results." : "Import an activity CSV, then scan to load performance and daily P&L."}</span></td></tr>}</tbody></table></div>
        <footer className="table-footer"><span>{shown.length} of {rows.length} wallets{!saved ? " · Not saved yet" : ""}</span><span>Monthly metrics use UTC calendar days. Avg. invested and 30d P&L use a rolling window.</span></footer>
      </section>
    </div>
    {hover && <div className="hover-calendar" style={{ left: Math.max(8, Math.min(hover.x + 18, window.innerWidth - 570)), top: Math.max(8, hover.y + 345 > window.innerHeight ? hover.y - 325 : hover.y + 18) }}><Calendar row={hover.row} month={month} compact /></div>}
  </main>;
}
