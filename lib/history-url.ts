export const HISTORY_PAGE_SIZE = 100;

export function historyUrl(wallet: string, pool: string | null, page: string, pageSize: string | null) {
  const params = new URLSearchParams({ user: wallet, page });
  if (pool) params.set('status', 'closed');
  if (pageSize) params.set('page_size', pageSize);
  else if (!pool) params.set('page_size', '50'); // Older clients use 50 pools and Meteora's default for positions.
  const path = pool ? `positions/${encodeURIComponent(pool)}/pnl` : 'portfolio';
  return `https://dlmm.datapi.meteora.ag/${path}?${params}`;
}
