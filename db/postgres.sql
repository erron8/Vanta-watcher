CREATE TABLE IF NOT EXISTS scans (
  id text PRIMARY KEY,
  source_name text NOT NULL,
  month text NOT NULL,
  wallet_count integer NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scan_id text NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  address text NOT NULL,
  activities integer NOT NULL,
  avg_invested double precision,
  avg_invested_sol double precision,
  pnl_30d double precision,
  pnl_30d_sol double precision,
  active_days integer,
  max_loss double precision,
  max_profit double precision,
  monthly_profit double precision,
  calendar_json text NOT NULL,
  error text,
  UNIQUE(scan_id, address)
);

CREATE INDEX IF NOT EXISTS idx_wallet_metrics_scan_id ON wallet_metrics(scan_id);

CREATE TABLE IF NOT EXISTS bookmarks (
  address text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  categories_json text NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS wallet_profiles (
  address text PRIMARY KEY,
  profile_json text NOT NULL
);

-- Private tables are separate so immutable older deployments cannot read
-- newly saved account data using their legacy global queries.
CREATE TABLE IF NOT EXISTS account_scans (
  id text PRIMARY KEY,
  account text NOT NULL,
  source_name text NOT NULL,
  month text NOT NULL,
  wallet_count integer NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_scans_owner_created ON account_scans(account, created_at DESC);

CREATE TABLE IF NOT EXISTS account_wallet_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scan_id text NOT NULL REFERENCES account_scans(id) ON DELETE CASCADE,
  address text NOT NULL,
  activities integer NOT NULL,
  avg_invested double precision,
  avg_invested_sol double precision,
  pnl_30d double precision,
  pnl_30d_sol double precision,
  active_days integer,
  max_loss double precision,
  max_profit double precision,
  monthly_profit double precision,
  calendar_json text NOT NULL,
  error text,
  UNIQUE(scan_id, address)
);
CREATE INDEX IF NOT EXISTS idx_account_wallet_metrics_scan_id ON account_wallet_metrics(scan_id);

CREATE TABLE IF NOT EXISTS account_wallet_profiles (
  account text NOT NULL,
  address text NOT NULL,
  profile_json text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account, address)
);
CREATE INDEX IF NOT EXISTS idx_account_wallet_profiles_updated ON account_wallet_profiles(account, updated_at DESC);

-- Preserve the latest pre-upgrade shared scan and labels for the admin once.
INSERT INTO account_scans (id, account, source_name, month, wallet_count, created_at)
SELECT id, 'admin', source_name, month, wallet_count, created_at FROM scans
WHERE NOT EXISTS (SELECT 1 FROM account_scans WHERE account = 'admin')
ORDER BY created_at DESC LIMIT 1 ON CONFLICT (id) DO NOTHING;
INSERT INTO account_wallet_metrics (scan_id, address, activities, avg_invested, avg_invested_sol, pnl_30d, pnl_30d_sol, active_days, max_loss, max_profit, monthly_profit, calendar_json, error)
SELECT m.scan_id, m.address, m.activities, m.avg_invested, m.avg_invested_sol, m.pnl_30d, m.pnl_30d_sol, m.active_days, m.max_loss, m.max_profit, m.monthly_profit, m.calendar_json, m.error
FROM wallet_metrics m JOIN account_scans s ON s.id = m.scan_id AND s.account = 'admin'
ON CONFLICT (scan_id, address) DO NOTHING;
INSERT INTO account_wallet_profiles (account, address, profile_json)
SELECT 'admin', address, profile_json FROM wallet_profiles ON CONFLICT (account, address) DO NOTHING;

CREATE TABLE IF NOT EXISTS rate_limits (
  key text NOT NULL,
  bucket bigint NOT NULL,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key, bucket)
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS revoked_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires ON revoked_sessions(expires_at);

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  session_version uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_users_username_format CHECK (username ~ '^[a-z][a-z0-9_-]{2,31}$')
);

CREATE TABLE IF NOT EXISTS owner_credentials (
  id integer PRIMARY KEY CHECK (id = 1),
  username text NOT NULL,
  password_hash text NOT NULL,
  session_version uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT owner_credentials_username_format CHECK (username ~ '^[a-z][a-z0-9_-]{2,31}$')
);

CREATE TABLE IF NOT EXISTS waitlist (
  id uuid PRIMARY KEY,
  telegram_handle text NOT NULL UNIQUE,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_telegram_format CHECK (telegram_handle ~ '^@[a-z0-9_]{5,32}$')
);
CREATE INDEX IF NOT EXISTS idx_waitlist_done_created ON waitlist(done, created_at DESC);
