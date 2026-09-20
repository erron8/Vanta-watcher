import type { Match } from './history';

export type WalletProfile = { sampleCount: number; quoteCount: number | null; avgHoldSeconds: number | null; maxBins: number | null; checkedAt: string };
const quoteMints = new Set(['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']);
const numeric = (v: unknown) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;

export function classifyPositions(positions: Match[]): WalletProfile {
  const unique = [...new Map(positions.map(p => [p.positionAddress, p])).values()];
  // Select globally by closing time, never by the upstream pool/page order.
  const recent = unique.filter(p => Number.isFinite(p.closedAt) && p.closedAt > 0).sort((a, b) => b.closedAt - a.closedAt || a.positionAddress.localeCompare(b.positionAddress)).slice(0, 30);
  const holds = recent.map(p => Number.isFinite(p.createdAt) && p.createdAt > 0 && p.createdAt <= p.closedAt ? p.closedAt - p.createdAt : null);
  const bins = recent.map(p => Number.isInteger(p.lowerBinId) && Number.isInteger(p.upperBinId) && p.upperBinId! >= p.lowerBinId! ? p.upperBinId! - p.lowerBinId! + 1 : null);
  const quotes = recent.map(p => {
    const x = numeric(p.allTimeDeposits?.tokenX?.amount), y = numeric(p.allTimeDeposits?.tokenY?.amount);
    if (x === null || y === null || x < 0 || y < 0 || !p.pool.tokenXMint || !p.pool.tokenYMint) return null;
    return x + y > 0 && (x === 0 || quoteMints.has(p.pool.tokenXMint)) && (y === 0 || quoteMints.has(p.pool.tokenYMint));
  });
  return { sampleCount: recent.length, quoteCount: quotes.includes(null) ? null : quotes.filter(Boolean).length,
    avgHoldSeconds: !recent.length || holds.includes(null) ? null : (holds as number[]).reduce((a, b) => a + b, 0) / recent.length,
    maxBins: !recent.length || bins.includes(null) ? null : Math.max(...bins as number[]), checkedAt: new Date().toISOString() };
}

export function labelsFor(profile: WalletProfile): string[] {
  if (profile.sampleCount < 30) return [];
  const labels: string[] = [];
  if (profile.quoteCount !== null && profile.quoteCount >= 16) labels.push('Quote only');
  if (profile.avgHoldSeconds !== null && profile.avgHoldSeconds > 3600) labels.push('Multi');
  if (profile.avgHoldSeconds !== null && profile.avgHoldSeconds < 900 && profile.maxBins !== null && profile.maxBins <= 30) labels.push('Degen');
  return labels;
}
