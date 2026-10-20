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
