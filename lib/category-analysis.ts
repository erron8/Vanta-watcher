import type { Match } from './history';
import { emptyCategories, type BookmarkCategories } from './bookmark-categories.ts';

const quoteMints = new Set(['So11111111111111111111111111111111111111112', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v']);
const numeric = (value: unknown) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export type CategoryEvidence = {
  positions: number;
  deposits: { quoteOnly: number; doubleSided: number; baseOnly: number; unknown: number };
  averageHoldSeconds: number | null;
  averageBins: number | null;
  openingSessions: { Asia: number; London: number; NYC: number };
};

export function suggestCategories(positions: Match[]): { categories: BookmarkCategories; evidence: CategoryEvidence } {
  const recent = [...new Map(positions.map(position => [position.positionAddress, position])).values()]
    .filter(position => Number.isFinite(position.closedAt) && position.closedAt > 0)
    .sort((a, b) => b.closedAt - a.closedAt || a.positionAddress.localeCompare(b.positionAddress)).slice(0, 30);
  const categories = { ...emptyCategories };
  const deposits = { quoteOnly: 0, doubleSided: 0, baseOnly: 0, unknown: 0 };
  const holds: number[] = [], widths: number[] = [];
  const openingSessions = { Asia: 0, London: 0, NYC: 0 };

  for (const position of recent) {
    const x = numeric(position.allTimeDeposits?.tokenX?.amount);
    const y = numeric(position.allTimeDeposits?.tokenY?.amount);
    if (x === null || y === null || x < 0 || y < 0 || x + y <= 0) deposits.unknown++;
    else if (x > 0 && y > 0) deposits.doubleSided++;
    else {
      const mint = x > 0 ? position.pool.tokenXMint : position.pool.tokenYMint;
      const otherMint = x > 0 ? position.pool.tokenYMint : position.pool.tokenXMint;
      if (!mint || !otherMint) deposits.unknown++;
      else if (quoteMints.has(mint)) deposits.quoteOnly++;
      else if (quoteMints.has(otherMint)) deposits.baseOnly++;
      else deposits.unknown++;
    }
    if (Number.isFinite(position.createdAt) && position.createdAt > 0 && position.createdAt <= position.closedAt) {
      holds.push(position.closedAt - position.createdAt);
      const hour = new Date(position.createdAt * 1000).getUTCHours();
      openingSessions[hour < 8 ? 'Asia' : hour < 16 ? 'London' : 'NYC']++;
    }
    if (Number.isInteger(position.lowerBinId) && Number.isInteger(position.upperBinId) && position.upperBinId! >= position.lowerBinId!) widths.push(position.upperBinId! - position.lowerBinId! + 1);
  }

  const averageHoldSeconds = holds.length === recent.length && recent.length ? holds.reduce((sum, value) => sum + value, 0) / holds.length : null;
  const averageBins = widths.length === recent.length && recent.length ? widths.reduce((sum, value) => sum + value, 0) / widths.length : null;
  if (recent.length === 30) {
    const depositWinner = Object.entries(deposits).filter(([key]) => key !== 'unknown').sort((a, b) => b[1] - a[1])[0];
    if (depositWinner && depositWinner[1] >= 16) {
      if (depositWinner[0] === 'quoteOnly') categories.deposits = 'Quote only';
      if (depositWinner[0] === 'doubleSided') categories.deposits = 'Double sided';
      if (depositWinner[0] === 'baseOnly') categories.deposits = 'Meme only';
    }
    if (averageHoldSeconds !== null) {
      if (averageHoldSeconds < 900) categories.hold = 'Degen';
      if (averageHoldSeconds > 3600) categories.hold = 'Multi';
    }
    if (averageBins !== null) {
      if (averageBins < 25) categories.range = 'Tight';
      if (averageBins >= 26 && averageBins <= 100) categories.range = 'Normal';
      if (averageBins > 100) categories.range = 'Wide';
    }
    const dominantSession = Object.entries(openingSessions).sort((a, b) => b[1] - a[1])[0];
    if (holds.length === 30 && dominantSession?.[1] >= 21) categories.timezone = dominantSession[0] as BookmarkCategories['timezone'];
  }
  return { categories, evidence: { positions: recent.length, deposits, averageHoldSeconds, averageBins, openingSessions } };
}
