BEGIN;

ALTER TABLE store_members DROP CONSTRAINT IF EXISTS store_members_role_check;
ALTER TABLE store_members ADD CONSTRAINT store_members_role_check CHECK (role IN ('owner', 'staff'));

CREATE TABLE IF NOT EXISTS store_invitations (
  id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL, accepted_at timestamptz, accepted_by text, revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS store_invitations_store_idx ON store_invitations(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS commerce_orders (
  id uuid PRIMARY KEY, store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL, payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  tracking_hash text NOT NULL CHECK (tracking_hash ~ '^[a-f0-9]{64}$'),
  lines jsonb NOT NULL CHECK (jsonb_typeof(lines)='array' AND jsonb_array_length(lines) BETWEEN 1 AND 50),
  total numeric(16,2) NOT NULL CHECK (total >= 0 AND total <= 1000000000000),
  currency_code char(3) NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','preparing','ready','completed','cancelled')),
  payment_method text NOT NULL CHECK (payment_method IN ('orange_money','momo','cash')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  customer_name text CHECK (char_length(customer_name) <= 80),
  customer_phone text CHECK (char_length(customer_phone) <= 24),
  note text CHECK (char_length(note) <= 500),
  version integer NOT NULL DEFAULT 0, history jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS commerce_orders_store_idx ON commerce_orders(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_members (
  auth_subject text PRIMARY KEY, role text NOT NULL CHECK (role='support'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_requests (
  id uuid PRIMARY KEY, tracking_hash text NOT NULL CHECK (tracking_hash ~ '^[a-f0-9]{64}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
  store_slug text CHECK (char_length(store_slug) <= 80),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  reply text CHECK (char_length(reply) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_requests_status_idx ON support_requests(status, created_at DESC);

CREATE TABLE IF NOT EXISTS support_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid NOT NULL REFERENCES support_requests(id) ON DELETE CASCADE,
  actor_subject text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
