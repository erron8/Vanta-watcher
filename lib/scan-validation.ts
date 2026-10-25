import type { Day, Row } from '@/app/screener-ui';

const addressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const dailyAmounts = ['pnl_usd', 'pnl_sol', 'deposit_usd', 'deposit_sol', 'withdrawn_usd', 'withdrawn_sol', 'fees_earned_usd', 'fees_earned_sol', 'win_rate_usd', 'win_rate_sol'] as const;
const optionalMetrics = ['avgInvested', 'avgInvestedSol', 'pnl30d', 'pnl30dSol', 'activeDays', 'maxLoss', 'monthlyProfit'] as const;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finiteMetric(value: unknown) {
  return value === null || typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e15;
}

function validAmount(value: unknown) {
  return (typeof value === 'string' && value.length <= 80 || typeof value === 'number')
    && value !== '' && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= 1e15;
}

export function parseDay(value: unknown): Day | null {
  if (!record(value) || typeof value.date_time !== 'string' || value.date_time.length > 40) return null;
  const date = value.date_time.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(value.date_time))
    || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || !validAmount(value.pnl_usd)) return null;
  if (value.closed_position_count !== undefined && (!Number.isInteger(value.closed_position_count) || Number(value.closed_position_count) < 0 || Number(value.closed_position_count) > 1e7)) return null;
  const day: Record<string, unknown> = { date_time: value.date_time, pnl_usd: String(value.pnl_usd) };
  for (const field of dailyAmounts) {
    if (field === 'pnl_usd' || value[field] === undefined || value[field] === null) continue;
    if (!validAmount(value[field])) return null;
    day[field] = String(value[field]);
  }
  if (value.closed_position_count !== undefined) day.closed_position_count = value.closed_position_count;
  return day as Day;
}

export function parseScanRow(value: unknown): Row | null {
  if (!record(value) || typeof value.address !== 'string' || !addressPattern.test(value.address)
    || !Number.isInteger(value.activities) || Number(value.activities) < 0 || Number(value.activities) > 1e7
    || !Array.isArray(value.calendar) || value.calendar.length > 62) return null;
  const calendar = value.calendar.map(parseDay);
  if (calendar.some(day => day === null)) return null;
  for (const field of optionalMetrics) if (value[field] !== undefined && !finiteMetric(value[field])) return null;
  if (value.activeDays != null && (!Number.isInteger(value.activeDays) || Number(value.activeDays) < 0 || Number(value.activeDays) > 62)) return null;
  if (value.maxLoss != null && Number(value.maxLoss) < 0) return null;
  if (value.error != null && (typeof value.error !== 'string' || value.error.length > 240)) return null;
  return {
    address: value.address, activities: Number(value.activities),
    avgInvested: value.avgInvested as number | null ?? null,
    avgInvestedSol: value.avgInvestedSol as number | null ?? null,
    pnl30d: value.pnl30d as number | null ?? null,
    pnl30dSol: value.pnl30dSol as number | null ?? null,
    activeDays: value.activeDays as number | null ?? null,
    maxLoss: value.maxLoss as number | null ?? null,
    monthlyProfit: value.monthlyProfit as number | null ?? null,
    calendar: calendar as Day[], error: (value.error as string | null) ?? undefined,
  };
}

export function parseScanRows(value: unknown): Row[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 2000) return null;
  const rows = value.map(parseScanRow);
  if (rows.some(row => row === null)) return null;
  if (new Set(rows.map(row => row!.address)).size !== rows.length) return null;
  return rows as Row[];
}
