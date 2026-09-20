export type Pool = { poolAddress: string; tokenX: string; tokenY: string; binStep: string; baseFee: string; lastClosedAt?: number };
export type Position = { positionAddress: string; createdAt: number; closedAt: number; pnlUsd: string; pnlPctChange: string; allTimeDeposits: { total: { usd: string } }; allTimeWithdrawals: { total: { usd: string } }; allTimeFees: { total: { usd: string } } };
export type Match = Position & { wallet: string; pool: Pool };
type Page = { pools?: Pool[]; positions?: Position[]; hasNext: boolean };
const cache = new Map<string, { at: number; value: Page }>();
let starts: number[] = [];
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function reserveRequest(signal?: AbortSignal) {
  while (true) {
    signal?.throwIfAborted();
    const now = Date.now(); starts = starts.filter(t => now - t < 1000);
    if (starts.length < 24) { starts.push(now); return; }
    await sleep(50);
  }
}
async function get(query: string, signal: AbortSignal): Promise<Page> {
  signal.throwIfAborted();
  const saved = cache.get(query);
  if (saved && Date.now() - saved.at < 300000) return saved.value;
  for (let attempt = 0; attempt < 3; attempt++) {
    await reserveRequest(signal);
    const r = await fetch('/api/history?' + query, { signal });
    if ((r.status === 429 || r.status >= 500) && attempt < 2) { await sleep(1000 * (attempt + 1)); continue; }
    if (!r.ok) throw new Error(`History unavailable (${r.status})`);
    const value = await r.json() as Page;
    if (typeof value.hasNext !== 'boolean') throw new Error('Incomplete history response');
    if (cache.size >= 1500) cache.delete(cache.keys().next().value!);
    cache.set(query, { at: Date.now(), value }); return value;
  }
  throw new Error('History unavailable');
}
export async function history(wallet: string, signal: AbortSignal, onPosition: (p: Match) => void, options: { date?: string; pair?: string; progress?: (text: string) => void } = {}) {
  const pools = new Map<string, Pool>();
  for (let page = 1; ; page++) {
    options.progress?.(`Loading pool page ${page}`);
    const data = await get(new URLSearchParams({ user: wallet, page: String(page) }).toString(), signal);
    if (!Array.isArray(data.pools)) throw new Error('Missing pool history');
    data.pools.forEach(p => pools.set(p.poolAddress, p));
    if (!data.hasNext) break;
    if (!data.pools.length) throw new Error('Incomplete pool pagination');
  }
  const start = options.date ? Date.parse(options.date + 'T00:00:00Z') / 1000 : null;
  const queue = [...pools.values()].filter(p => (!options.pair || `${p.tokenX}-${p.tokenY}`.toLowerCase().includes(options.pair.toLowerCase())) && (start === null || !p.lastClosedAt || p.lastClosedAt >= start));
  const seen = new Set<string>(); let done = 0;
  const results = await Promise.allSettled(Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      signal.throwIfAborted(); const pool = queue.shift()!;
      for (let page = 1; ; page++) {
        const data = await get(new URLSearchParams({ user: wallet, pool: pool.poolAddress, page: String(page) }).toString(), signal);
        if (!Array.isArray(data.positions)) throw new Error('Missing position history');
        for (const p of data.positions) {
          if (!seen.has(p.positionAddress) && p.closedAt && (start === null || p.closedAt >= start && p.closedAt < start + 86400)) { seen.add(p.positionAddress); onPosition({ ...p, wallet, pool }); }
        }
        if (!data.hasNext) break;
        if (!data.positions.length) throw new Error('Incomplete position pagination');
      }
      options.progress?.(`${++done} pools checked · ${queue.length} queued`);
    }
  }));
  signal.throwIfAborted();
  const error = results.find(r => r.status === 'rejected');
  if (error?.status === 'rejected') throw error.reason;
}
export function duration(seconds: number) { return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60].map(n => String(n).padStart(2, '0')).join(':'); }
export function matches(p: Match, target: { tvl: number; tolerance: number; pnl?: number; pnlTolerance: number; seconds?: number; secondsTolerance: number }) {
  const invested = Number(p.allTimeDeposits?.total?.usd), pnl = Number(p.pnlUsd), seconds = p.closedAt - p.createdAt;
  return Number.isFinite(invested) && Math.abs(invested - target.tvl) <= target.tolerance
    && (target.pnl === undefined || Number.isFinite(pnl) && Math.abs(pnl - target.pnl) <= target.pnlTolerance)
    && (target.seconds === undefined || Number.isFinite(seconds) && Math.abs(seconds - target.seconds) <= target.secondsTolerance);
}
