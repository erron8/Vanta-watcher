import { env } from 'cloudflare:workers';
import type { WalletProfile } from '@/lib/wallet-labels';

export async function GET() {
  if (!env.DB) return Response.json({ error: 'Database unavailable' }, { status: 503 });
  try {
    const result = await env.DB.prepare('SELECT address, profile_json FROM wallet_profiles').all<{ address: string; profile_json: string }>();
    return Response.json(Object.fromEntries(result.results.map(r => [r.address, JSON.parse(r.profile_json)])));
  } catch { return Response.json({ error: 'Could not load saved labels.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: 'Database unavailable' }, { status: 503 });
  try {
    const { address, profile } = await request.json() as { address: string; profile: WalletProfile };
    const validNumber = (v: unknown) => v === null || typeof v === 'number' && Number.isFinite(v) && v >= 0;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) || !profile || !Number.isInteger(profile.sampleCount) || profile.sampleCount < 0 || profile.sampleCount > 30
      || !validNumber(profile.quoteCount) || profile.quoteCount !== null && (!Number.isInteger(profile.quoteCount) || profile.quoteCount > profile.sampleCount)
      || !validNumber(profile.avgHoldSeconds) || !validNumber(profile.maxBins) || profile.maxBins !== null && (!Number.isInteger(profile.maxBins) || profile.maxBins < 1)) return Response.json({ error: 'Invalid wallet profile' }, { status: 400 });
    const saved = { sampleCount: profile.sampleCount, quoteCount: profile.quoteCount, avgHoldSeconds: profile.avgHoldSeconds, maxBins: profile.maxBins, checkedAt: new Date().toISOString() };
    await env.DB.prepare('INSERT INTO wallet_profiles (address, profile_json) VALUES (?, ?) ON CONFLICT(address) DO UPDATE SET profile_json = excluded.profile_json').bind(address, JSON.stringify(saved)).run();
    return Response.json(saved);
  } catch { return Response.json({ error: 'Could not save wallet labels.' }, { status: 503 }); }
}
