import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const scans = sqliteTable("scans", {
  id: text("id").primaryKey(),
  sourceName: text("source_name").notNull(),
  month: text("month").notNull(),
  walletCount: integer("wallet_count").notNull(),
  createdAt: text("created_at").notNull(),
});

export const walletMetrics = sqliteTable(
  "wallet_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scanId: text("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    address: text("address").notNull(),
    activities: integer("activities").notNull(),
    avgInvested: real("avg_invested"),
    pnl30d: real("pnl_30d"),
    activeDays: integer("active_days"),
    maxLoss: real("max_loss"),
    monthlyProfit: real("monthly_profit"),
    calendarJson: text("calendar_json").notNull(),
    error: text("error"),
  },
  (table) => [uniqueIndex("idx_wallet_metrics_scan_address").on(table.scanId, table.address)],
);
