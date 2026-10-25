import { database } from '@/db/postgres';
import { authenticateRequest } from '@/lib/authorize';
import { parseScanRow, parseScanRows } from '@/lib/scan-validation';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sameOrigin } from '@/lib/access';

export const runtime = 'nodejs';
type ScanRecord = { id: string; sourceName: string; month: string; walletCount: number; createdAt: Date };

export async function GET(request: Request) {
  const identity = await authenticateRequest(request);
  if (!identity) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  try {
    const scanResult = await database().query<ScanRecord>('SELECT id, source_name AS "sourceName", month, wallet_count AS "walletCount", created_at AS "createdAt" FROM account_scans WHERE account = $1 ORDER BY created_at DESC LIMIT 1', [identity.account]);
    const scan = scanResult.rows[0];
    if (!scan) return Response.json({ scan: null, rows: [] });
    const result = await database().query<Record<string, unknown>>('SELECT address, activities, avg_invested AS "avgInvested", avg_invested_sol AS "avgInvestedSol", pnl_30d AS "pnl30d", pnl_30d_sol AS "pnl30dSol", active_days AS "activeDays", max_loss AS "maxLoss", max_profit AS "maxProfit", monthly_profit AS "monthlyProfit", calendar_json AS "calendarJson", error FROM account_wallet_metrics WHERE scan_id = $1', [scan.id]);
    const rows = result.rows.flatMap(row => {
      try {
        const parsed = parseScanRow({ ...row, calendar: JSON.parse(String(row.calendarJson || '[]')) });
        return parsed ? [parsed] : [];
      } catch { return []; }
    });
    return Response.json({ scan: { ...scan, createdAt: scan.createdAt.toISOString() }, rows }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return Response.json({ error: 'Could not load saved scans.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const identity = await authenticateRequest(request);
  if (!identity) return Response.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (!sameOrigin(request)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  const limit = await enforceRateLimit(identity.account, 'save-scan', 50, 24 * 3600); if (limit) return limit;
  let body: { sourceName?: unknown; month?: unknown; rows?: unknown };
  try {
    const raw = await request.text();
    if (raw.length > 3_500_000) return Response.json({ error: 'Scan is too large to save.' }, { status: 413 });
    body = JSON.parse(raw) as typeof body;
  } catch { return Response.json({ error: 'Invalid scan payload.' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.sourceName !== 'string' || !body.sourceName.trim() || body.sourceName.length > 240
    || typeof body.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)) return Response.json({ error: 'Invalid scan payload.' }, { status: 400 });
  const rows = parseScanRows(body.rows);
  if (!rows) return Response.json({ error: 'Invalid wallet data.' }, { status: 400 });
  let client;
  try { client = await database().connect(); }
  catch { return Response.json({ error: 'Could not connect to the database.' }, { status: 503 }); }
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO account_scans (id, account, source_name, month, wallet_count, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [id, identity.account, body.sourceName, body.month, rows.length, createdAt]);
    for (let start = 0; start < rows.length; start += 200) {
      const batch = rows.slice(start, start + 200);
      const values: unknown[] = [];
      const placeholders = batch.map(row => {
        const entry = [id, row.address, row.activities, row.avgInvested, row.avgInvestedSol ?? null, row.pnl30d, row.pnl30dSol ?? null, row.activeDays, row.maxLoss, null, row.monthlyProfit, JSON.stringify(row.calendar), row.error || null];
        const offset = values.length;
        values.push(...entry);
        return `(${entry.map((_, index) => `$${offset + index + 1}`).join(',')})`;
      });
      await client.query(`INSERT INTO account_wallet_metrics (scan_id, address, activities, avg_invested, avg_invested_sol, pnl_30d, pnl_30d_sol, active_days, max_loss, max_profit, monthly_profit, calendar_json, error) VALUES ${placeholders.join(',')}`, values);
    }
    await client.query(`DELETE FROM account_scans WHERE account = $1 AND id NOT IN
      (SELECT id FROM account_scans WHERE account = $1 ORDER BY created_at DESC LIMIT 20)`, [identity.account]);
    await client.query('COMMIT');
    return Response.json({ scan: { id, sourceName: body.sourceName, month: body.month, walletCount: rows.length, createdAt } }, { status: 201 });
  } catch {
    try { await client.query('ROLLBACK'); } catch { /* connection already closed */ }
    return Response.json({ error: 'Could not save this scan.' }, { status: 503 });
  } finally { client.release(); }
}
