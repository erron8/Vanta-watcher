CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`source_name` text NOT NULL,
	`month` text NOT NULL,
	`wallet_count` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wallet_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scan_id` text NOT NULL,
	`address` text NOT NULL,
	`activities` integer NOT NULL,
	`avg_invested` real,
	`pnl_30d` real,
	`active_days` integer,
	`max_loss` real,
	`monthly_profit` real,
	`calendar_json` text NOT NULL,
	`error` text,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_wallet_metrics_scan_address` ON `wallet_metrics` (`scan_id`,`address`);