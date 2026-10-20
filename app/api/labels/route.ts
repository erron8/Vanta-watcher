import { database } from '@/db/postgres';
import { denyAnonymous } from '@/lib/authorize';
import type { WalletProfile } from '@/lib/wallet-labels';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const denied = await denyAnonymous(request); if (denied) return denied;
  try {
    const result = await database().query<{ address: string; profile_json: string }>('SELECT address, profile_json FROM wallet_profiles');
    return Response.json(Object.fromEntries(result.rows.map(row => [row.address, JSON.parse(row.profile_json)])), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Could not load saved labels.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const denied = await denyAnonymous(request); if (denied) return denied;
  try {
    const { address, profile } = await request.json() as { address: string; profile: WalletProfile };
    const validNumber = (value: unknown) => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) || !profile || !Number.isInteger(profile.sampleCount) || profile.sampleCount < 0 || profile.sampleCount > 30
      || !validNumber(profile.quoteCount) || profile.quoteCount !== null && (!Number.isInteger(profile.quoteCount) || profile.quoteCount > profile.sampleCount)
      || !validNumber(profile.avgHoldSeconds) || !validNumber(profile.maxBins) || profile.maxBins !== null && (!Number.isInteger(profile.maxBins) || profile.maxBins < 1)) return Response.json({ error: 'Invalid wallet profile' }, { status: 400 });
    const saved = { sampleCount: profile.sampleCount, quoteCount: profile.quoteCount, avgHoldSeconds: profile.avgHoldSeconds, maxBins: profile.maxBins, checkedAt: new Date().toISOString() };
    await database().query('INSERT INTO wallet_profiles (address, profile_json) VALUES ($1, $2) ON CONFLICT(address) DO UPDATE SET profile_json = excluded.profile_json', [address, JSON.stringify(saved)]);
    return Response.json(saved);
  } catch { return Response.json({ error: 'Could not save wallet labels.' }, { status: 503 }); }
}
