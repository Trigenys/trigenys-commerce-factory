BEGIN;

CREATE TABLE IF NOT EXISTS media_objects (
  id uuid PRIMARY KEY,
  public_id uuid NOT NULL UNIQUE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('logo', 'product')),
  object_key text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type = 'image/webp'),
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 2097152),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'logo' AND product_id IS NULL)
    OR
    (kind = 'product' AND product_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS media_objects_store_created_idx
  ON media_objects(store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS media_objects_product_created_idx
  ON media_objects(product_id, created_at DESC)
  WHERE product_id IS NOT NULL;

COMMIT;
