import { denyUpstream } from '@/lib/rate-limit';
import { isSolanaAddress } from '@/lib/solana-address';
import { parsePoolSearch } from '@/lib/pool-search';

export async function GET(request: Request) {
  const denied = await denyUpstream(request); if (denied) return denied;
  const url = new URL(request.url);
  const mint = url.searchParams.get('mint') || '';
  const page = Number(url.searchParams.get('page') || '1');
  if (!isSolanaAddress(mint) || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
    return Response.json({ error: 'Enter a valid Solana token contract address.' }, { status: 400 });
  }
  try {
    const query = new URLSearchParams({ query: mint, page: String(page), page_size: '100' });
    const response = await fetch(`https://dlmm.datapi.meteora.ag/pools?${query}`, { signal: AbortSignal.timeout(12000), next: { revalidate: 60 } });
    if (!response.ok) return Response.json({ error: response.status === 429 ? 'Meteora is busy. Try again shortly.' : 'Could not load pools. Try again.' }, { status: response.status === 429 ? 429 : 502 });
    return Response.json(parsePoolSearch(await response.json(), mint, page), { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch {
    return Response.json({ error: 'Pool search is unavailable. Try again.' }, { status: 502 });
  }
}
