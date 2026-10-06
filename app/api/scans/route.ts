import { env } from "cloudflare:workers";

type Metric = {
  address: string;
  activities: number;
  avgInvested: number | null;
  avgInvestedSol?: number | null;
  pnl30d: number | null;
  pnl30dSol?: number | null;
  activeDays: number | null;
  maxLoss: number | null;
  maxProfit: number | null;
  monthlyProfit: number | null;
  calendar: unknown[];
  error?: string | null;
};

function database() {
  if (!env.DB) throw new Error("The database is not configured yet.");
  return env.DB;
}

export async function GET() {
  try {
    const db = database();
    const scan = await db
      .prepare("SELECT id, source_name AS sourceName, month, wallet_count AS walletCount, created_at AS createdAt FROM scans ORDER BY created_at DESC LIMIT 1")
      .first<Record<string, unknown>>();
    if (!scan) return Response.json({ scan: null, rows: [] });
    const result = await db
      .prepare("SELECT address, activities, avg_invested AS avgInvested, avg_invested_sol AS avgInvestedSol, pnl_30d AS pnl30d, pnl_30d_sol AS pnl30dSol, active_days AS activeDays, max_loss AS maxLoss, max_profit AS maxProfit, monthly_profit AS monthlyProfit, calendar_json AS calendarJson, error FROM wallet_metrics WHERE scan_id = ?")
      .bind(scan.id)
      .all<Record<string, unknown>>();
    return Response.json({
      scan,
      rows: result.results.map((row) => ({ ...row, calendar: JSON.parse(String(row.calendarJson || "[]")), calendarJson: undefined })),
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load saved scans." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sourceName?: string; month?: string; rows?: Metric[] };
    if (!body.sourceName || !/^\d{4}-(0[1-9]|1[0-2])$/.test(body.month || "") || !Array.isArray(body.rows) || body.rows.length === 0) {
      return Response.json({ error: "Invalid scan payload." }, { status: 400 });
    }
    if (body.rows.length > 2000 || body.rows.some((row) => !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.address) || !Array.isArray(row.calendar))) {
      return Response.json({ error: "Invalid wallet data." }, { status: 400 });
    }
    const db = database();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const statements = [
      db.prepare("INSERT INTO scans (id, source_name, month, wallet_count, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, body.sourceName.slice(0, 240), body.month, body.rows.length, createdAt),
      ...body.rows.map((row) =>
        db.prepare("INSERT INTO wallet_metrics (scan_id, address, activities, avg_invested, avg_invested_sol, pnl_30d, pnl_30d_sol, active_days, max_loss, max_profit, monthly_profit, calendar_json, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, row.address, row.activities, row.avgInvested, row.avgInvestedSol ?? null, row.pnl30d, row.pnl30dSol ?? null, row.activeDays, row.maxLoss, row.maxProfit, row.monthlyProfit, JSON.stringify(row.calendar), row.error || null),
      ),
    ];
    await db.batch(statements);
    return Response.json({ scan: { id, sourceName: body.sourceName, month: body.month, walletCount: body.rows.length, createdAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save this scan." }, { status: 503 });
  }
}
