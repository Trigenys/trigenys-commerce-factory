BEGIN;

CREATE TABLE IF NOT EXISTS commerce_events (
  id uuid PRIMARY KEY,
  event_name text NOT NULL
    CHECK (event_name IN ('store_view', 'product_view', 'whatsapp_order_click')),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commerce_events_store_event_created_idx
  ON commerce_events(store_id, event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS commerce_events_product_event_created_idx
  ON commerce_events(product_id, event_name, created_at DESC)
  WHERE product_id IS NOT NULL;

COMMIT;
