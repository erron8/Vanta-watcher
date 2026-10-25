import { denyUpstream } from '@/lib/rate-limit';
export async function GET(request: Request) {
  const denied = await denyUpstream(request); if (denied) return denied;
  const q = new URL(request.url).searchParams;
  const user = q.get("user") || "", pool = q.get("pool"), page = Number(q.get("page") || 1);
  const address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!address.test(user) || pool !== null && !address.test(pool) || !Number.isSafeInteger(page) || page < 1) return Response.json({ error: "Invalid history request" }, { status: 400 });
  const url = pool
    ? `https://dlmm.datapi.meteora.ag/positions/${pool}/pnl?user=${user}&status=closed&page=${page}`
    : `https://dlmm.datapi.meteora.ag/portfolio?user=${user}&page=${page}&page_size=50`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!response.ok) return Response.json({ error: `Meteora returned ${response.status}` }, { status: response.status >= 400 ? response.status : 502 });
    return Response.json(await response.json(), { headers: { "Cache-Control": "private, max-age=300" } });
  } catch { return Response.json({ error: "Position history timed out. Please retry." }, { status: 502 }); }
}
