import { database } from '@/db/postgres';
import { authenticateRequest } from '@/lib/authorize';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sameOrigin } from '@/lib/access';
import type { WalletProfile } from '@/lib/wallet-labels';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const identity = await authenticateRequest(request);
  if (!identity) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  try {
    const result = await database().query<{ address: string; profile_json: string }>('SELECT address, profile_json FROM account_wallet_profiles WHERE account = $1 ORDER BY address LIMIT 10000', [identity.account]);
    return Response.json(Object.fromEntries(result.rows.map(row => [row.address, JSON.parse(row.profile_json)])), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Could not load saved labels.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const identity = await authenticateRequest(request);
  if (!identity) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const limit = await enforceRateLimit(identity.account, 'save-label', 200, 24 * 3600); if (limit) return limit;
  try {
    const { address, profile } = await request.json() as { address: string; profile: WalletProfile };
    const validNumber = (value: unknown) => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) || !profile || !Number.isInteger(profile.sampleCount) || profile.sampleCount < 0 || profile.sampleCount > 30
      || !validNumber(profile.quoteCount) || profile.quoteCount !== null && (!Number.isInteger(profile.quoteCount) || profile.quoteCount > profile.sampleCount)
      || !validNumber(profile.avgHoldSeconds) || !validNumber(profile.maxBins) || profile.maxBins !== null && (!Number.isInteger(profile.maxBins) || profile.maxBins < 1)) return Response.json({ error: 'Invalid wallet profile' }, { status: 400 });
    const saved = { sampleCount: profile.sampleCount, quoteCount: profile.quoteCount, avgHoldSeconds: profile.avgHoldSeconds, maxBins: profile.maxBins, checkedAt: new Date().toISOString() };
    await database().query(`INSERT INTO account_wallet_profiles (account, address, profile_json) VALUES ($1, $2, $3)
      ON CONFLICT(account, address) DO UPDATE SET profile_json = excluded.profile_json, updated_at = now()`, [identity.account, address, JSON.stringify(saved)]);
    await database().query(`DELETE FROM account_wallet_profiles WHERE account = $1 AND address IN
      (SELECT address FROM account_wallet_profiles WHERE account = $1 ORDER BY updated_at DESC, address OFFSET 5000)`, [identity.account]);
    return Response.json(saved);
  } catch { return Response.json({ error: 'Could not save wallet labels.' }, { status: 503 }); }
}
