import { isSolanaAddress } from './solana-address.ts';

export type DlmmPool = { address: string; pair: string; binStep: number | null; baseFeePct: number | null; tvlUsd: number | null; volume24hUsd: number | null; fees24hUsd: number | null };
export type PoolSearchPage = { pools: DlmmPool[]; page: number; pages: number; total: number };

export function solscanLiquidityUrl(address: string, range?: { min: number; max: number }) {
  if (!isSolanaAddress(address)) throw new Error('Invalid pool address.');
  const query = new URLSearchParams({ activity_type: 'ACTIVITY_TOKEN_ADD_LIQ,ACTIVITY_TOKEN_DEPOSIT_VAULT', page_size: '10' });
  if (range) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min < 0 || range.max < range.min) {
      throw new Error('Invalid USD range.');
    }
    query.append('value', String(range.min));
    query.append('value', String(range.max));
  }
  return `https://solscan.io/account/${address}?${query}#activities`;
}

export function parsePoolSearch(data: unknown, mint: string, page: number): PoolSearchPage {
  const body = data as { data?: unknown; pages?: unknown; total?: unknown; current_page?: unknown };
  if (!body || !Array.isArray(body.data) || !Number.isInteger(body.pages) || Number(body.pages) < 0 || !Number.isInteger(body.total) || Number(body.total) < 0 || body.current_page !== page) {
    throw new Error('Invalid pool search response.');
  }
  const metric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  const pools = new Map<string, DlmmPool>();
  for (const value of body.data) {
    if (!value || typeof value !== 'object') continue;
    const pool = value as { tvl?: unknown; volume?: { '24h'?: unknown }; fees?: { '24h'?: unknown }; address?: string; token_x?: { address?: string; symbol?: string }; token_y?: { address?: string; symbol?: string }; pool_config?: { bin_step?: unknown; base_fee_pct?: unknown } };
    if (typeof pool.address !== 'string' || !isSolanaAddress(pool.address)) continue;
    // Search can also match pool addresses/names. Only accept exact token mint matches.
    if (pool.token_x?.address !== mint && pool.token_y?.address !== mint) continue;
    const label = (token: typeof pool.token_x) => typeof token?.symbol === 'string' && token.symbol.trim() ? token.symbol.trim().slice(0, 32) : (token?.address ? `${token.address.slice(0, 4)}…${token.address.slice(-4)}` : 'Unknown');
    pools.set(pool.address, { address: pool.address, pair: `${label(pool.token_x)}-${label(pool.token_y)}`, binStep: metric(pool.pool_config?.bin_step), baseFeePct: metric(pool.pool_config?.base_fee_pct),
      tvlUsd: metric(pool.tvl), volume24hUsd: metric(pool.volume?.['24h']), fees24hUsd: metric(pool.fees?.['24h']) });
  }
  return { pools: [...pools.values()], page, pages: Number(body.pages), total: Number(body.total) };
}
