BEGIN;

CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  whatsapp_number text NOT NULL CHECK (whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  country_code char(2) NOT NULL DEFAULT 'CM' CHECK (country_code ~ '^[A-Z]{2}$'),
  currency_code char(3) NOT NULL DEFAULT 'XAF' CHECK (currency_code ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS store_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  auth_subject text NOT NULL CHECK (char_length(auth_subject) BETWEEN 1 AND 255),
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, auth_subject)
);

CREATE INDEX IF NOT EXISTS store_members_auth_subject_idx
  ON store_members(auth_subject, store_id);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 180),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  currency_code char(3) NOT NULL DEFAULT 'XAF' CHECK (currency_code ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);

CREATE INDEX IF NOT EXISTS products_store_public_idx
  ON products(store_id, status, sort_order, created_at);

COMMIT;
