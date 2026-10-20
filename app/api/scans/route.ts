import { database } from '@/db/postgres';
import { denyAnonymous } from '@/lib/authorize';

export const runtime = 'nodejs';
type Metric = {
  address: string; activities: number; avgInvested: number | null; avgInvestedSol?: number | null;
  pnl30d: number | null; pnl30dSol?: number | null; activeDays: number | null;
  maxLoss: number | null; maxProfit: number | null; monthlyProfit: number | null;
  calendar: unknown[]; error?: string | null;
};
type ScanRecord = { id: string; sourceName: string; month: string; walletCount: number; createdAt: Date };

export async function GET(request: Request) {
  const denied = await denyAnonymous(request); if (denied) return denied;
  try {
    const scanResult = await database().query<ScanRecord>('SELECT id, source_name AS "sourceName", month, wallet_count AS "walletCount", created_at AS "createdAt" FROM scans ORDER BY created_at DESC LIMIT 1');
    const scan = scanResult.rows[0];
    if (!scan) return Response.json({ scan: null, rows: [] });
    const result = await database().query<Record<string, unknown>>('SELECT address, activities, avg_invested AS "avgInvested", avg_invested_sol AS "avgInvestedSol", pnl_30d AS "pnl30d", pnl_30d_sol AS "pnl30dSol", active_days AS "activeDays", max_loss AS "maxLoss", max_profit AS "maxProfit", monthly_profit AS "monthlyProfit", calendar_json AS "calendarJson", error FROM wallet_metrics WHERE scan_id = $1', [scan.id]);
    return Response.json({ scan: { ...scan, createdAt: scan.createdAt.toISOString() }, rows: result.rows.map(row => ({ ...row, calendar: JSON.parse(String(row.calendarJson || '[]')), calendarJson: undefined })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Could not load saved scans.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const denied = await denyAnonymous(request); if (denied) return denied;
  let body: { sourceName?: string; month?: string; rows?: Metric[] };
  try { body = await request.json() as typeof body; } catch { return Response.json({ error: 'Invalid scan payload.' }, { status: 400 }); }
  if (!body.sourceName || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month || '') || !Array.isArray(body.rows) || body.rows.length === 0) return Response.json({ error: 'Invalid scan payload.' }, { status: 400 });
  if (body.rows.length > 2000 || body.rows.some(row => !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.address) || !Array.isArray(row.calendar))) return Response.json({ error: 'Invalid wallet data.' }, { status: 400 });
  let client;
  try { client = await database().connect(); }
  catch { return Response.json({ error: 'Could not connect to the database.' }, { status: 503 }); }
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO scans (id, source_name, month, wallet_count, created_at) VALUES ($1, $2, $3, $4, $5)', [id, body.sourceName.slice(0, 240), body.month, body.rows.length, createdAt]);
    for (let start = 0; start < body.rows.length; start += 200) {
      const rows = body.rows.slice(start, start + 200);
      const values: unknown[] = [];
      const placeholders = rows.map(row => {
        const entry = [id, row.address, row.activities, row.avgInvested, row.avgInvestedSol ?? null, row.pnl30d, row.pnl30dSol ?? null, row.activeDays, row.maxLoss, row.maxProfit, row.monthlyProfit, JSON.stringify(row.calendar), row.error || null];
        const offset = values.length;
        values.push(...entry);
        return `(${entry.map((_, index) => `$${offset + index + 1}`).join(',')})`;
      });
      await client.query(`INSERT INTO wallet_metrics (scan_id, address, activities, avg_invested, avg_invested_sol, pnl_30d, pnl_30d_sol, active_days, max_loss, max_profit, monthly_profit, calendar_json, error) VALUES ${placeholders.join(',')}`, values);
    }
    await client.query('COMMIT');
    return Response.json({ scan: { id, sourceName: body.sourceName, month: body.month, walletCount: body.rows.length, createdAt } }, { status: 201 });
  } catch {
    try { await client.query('ROLLBACK'); } catch { /* connection already closed */ }
    return Response.json({ error: 'Could not save this scan.' }, { status: 503 });
  } finally { client.release(); }
}
