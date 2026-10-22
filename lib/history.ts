export type Pool = { poolAddress: string; tokenX: string; tokenY: string; tokenXMint?: string; tokenYMint?: string; binStep: string; baseFee: string; lastClosedAt?: number };
export type Position = { positionAddress: string; createdAt: number; closedAt: number; lowerBinId?: number; upperBinId?: number; pnlUsd: string; pnlSol?: string; pnlPctChange: string; pnlSolPctChange?: string; allTimeDeposits: { total: { usd: string; sol?: string }; tokenX?: { amount: string }; tokenY?: { amount: string } }; allTimeWithdrawals: { total: { usd: string; sol?: string } }; allTimeFees: { total: { usd: string; sol?: string } } };
export type Match = Position & { wallet: string; pool: Pool };
type Page = { pools?: Pool[]; positions?: Position[]; hasNext: boolean; totalCount?: number; pageSize?: number };
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
    const params = new URLSearchParams(query);
    const user = params.get('user')!;
    const pool = params.get('pool');
    const page = params.get('page') || '1';
    const upstream = pool
      ? `https://dlmm.datapi.meteora.ag/positions/${encodeURIComponent(pool)}/pnl?user=${encodeURIComponent(user)}&status=closed&page=${encodeURIComponent(page)}`
      : `https://dlmm.datapi.meteora.ag/portfolio?user=${encodeURIComponent(user)}&page=${encodeURIComponent(page)}&page_size=50`;
    let r: Response;
    try {
      r = await fetch(upstream, { signal, credentials: 'omit' });
      if (r.status === 403) r = await fetch('/api/history?' + query, { signal });
    } catch {
      signal.throwIfAborted();
      // Some networks block cross-origin requests; retain the authenticated proxy.
      r = await fetch('/api/history?' + query, { signal });
    }
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
  const poolPage = (page: number) => get(new URLSearchParams({ user: wallet, page: String(page) }).toString(), signal);
  const first = await poolPage(1);
  if (!Array.isArray(first.pools)) throw new Error('Missing pool history');
  first.pools.forEach(p => pools.set(p.poolAddress, p));
  if (first.hasNext && !first.pools.length) throw new Error('Incomplete pool pagination');
  const knownPages = first.hasNext && Number.isSafeInteger(first.totalCount) && Number.isSafeInteger(first.pageSize) && first.pageSize! > 0 && first.totalCount! > first.pools.length
    ? Math.min(200, Math.ceil(first.totalCount! / first.pageSize!)) : 1;
  if (knownPages > 1) {
    const pending = Array.from({ length: knownPages - 1 }, (_, index) => index + 2);
    const pages = new Map<number, Page>();
    let loaded = 1;
    await Promise.all(Array.from({ length: Math.min(6, pending.length) }, async () => {
      while (pending.length) {
        signal.throwIfAborted();
        const page = pending.shift()!;
        const data = await poolPage(page);
        if (!Array.isArray(data.pools)) throw new Error('Missing pool history');
        if (!data.pools.length) throw new Error('Incomplete pool pagination');
        pages.set(page, data);
        options.progress?.(`Loading pool pages ${++loaded}/${knownPages}`);
      }
    }));
    for (let page = 2; page <= knownPages; page++) pages.get(page)!.pools!.forEach(p => pools.set(p.poolAddress, p));
    if (pages.get(knownPages)?.hasNext) {
      for (let page = knownPages + 1; ; page++) {
        const data = await poolPage(page);
        if (!Array.isArray(data.pools) || !data.pools.length) throw new Error('Incomplete pool pagination');
        data.pools.forEach(p => pools.set(p.poolAddress, p));
        if (!data.hasNext) break;
      }
    }
  } else if (first.hasNext) {
    for (let page = 2; ; page++) {
      options.progress?.(`Loading pool page ${page}`);
      const data = await poolPage(page);
      if (!Array.isArray(data.pools) || !data.pools.length) throw new Error('Incomplete pool pagination');
      data.pools.forEach(p => pools.set(p.poolAddress, p));
      if (!data.hasNext) break;
    }
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
