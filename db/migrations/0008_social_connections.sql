BEGIN;

CREATE TABLE IF NOT EXISTS store_social_connections (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook','instagram','tiktok')),
  revision uuid NOT NULL, encrypted_token text,
  status text NOT NULL CHECK (status IN ('connected','disconnected','degraded')),
  account_name text, connected_at timestamptz, expires_at timestamptz,
  imported_at timestamptz, last_error text,
  PRIMARY KEY (store_id,provider)
);

CREATE TABLE IF NOT EXISTS social_oauth_attempts (
  id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  auth_subject text NOT NULL, provider text NOT NULL CHECK (provider IN ('facebook','instagram','tiktok')),
  start_hash text NOT NULL UNIQUE CHECK (start_hash ~ '^[a-f0-9]{64}$'),
  state_hash text UNIQUE CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  browser_hash text CHECK (browser_hash ~ '^[a-f0-9]{64}$'),
  result_hash text CHECK (result_hash ~ '^[a-f0-9]{64}$'),
  phase text NOT NULL DEFAULT 'created' CHECK (phase IN ('created','started','exchanging','ready','finished','failed')),
  redirect_uri text NOT NULL CHECK (redirect_uri ~ '^https://'),
  encrypted_token text, token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS social_oauth_expiry_idx ON social_oauth_attempts(expires_at);
CREATE INDEX IF NOT EXISTS social_oauth_store_idx ON social_oauth_attempts(store_id,provider);
CREATE UNIQUE INDEX IF NOT EXISTS social_oauth_one_attempt_idx ON social_oauth_attempts(store_id,provider);

CREATE TABLE IF NOT EXISTS store_social_previews (
  id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook','instagram','tiktok')),
  connection_revision uuid NOT NULL, auth_subject text NOT NULL,
  account_name text NOT NULL, profile_url text,
  proposed_values jsonb NOT NULL CHECK (jsonb_typeof(proposed_values)='object'),
  baseline_values jsonb NOT NULL CHECK (jsonb_typeof(baseline_values)='object'),
  truncated_fields jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(truncated_fields)='array'),
  applied_fields jsonb CHECK (jsonb_typeof(applied_fields)='array'),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  applied_at timestamptz
);
CREATE INDEX IF NOT EXISTS store_social_preview_expiry_idx ON store_social_previews(expires_at);

COMMIT;
