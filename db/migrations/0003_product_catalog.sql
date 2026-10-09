BEGIN;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS stock_label text,
  ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_description_length_check,
  ADD CONSTRAINT products_description_length_check
    CHECK (description IS NULL OR char_length(description) <= 2000),
  DROP CONSTRAINT IF EXISTS products_category_length_check,
  ADD CONSTRAINT products_category_length_check
    CHECK (category IS NULL OR char_length(category) <= 80),
  DROP CONSTRAINT IF EXISTS products_stock_label_length_check,
  ADD CONSTRAINT products_stock_label_length_check
    CHECK (stock_label IS NULL OR char_length(stock_label) <= 80),
  DROP CONSTRAINT IF EXISTS products_image_urls_array_check,
  ADD CONSTRAINT products_image_urls_array_check
    CHECK (
      jsonb_typeof(image_urls) = 'array'
      AND jsonb_array_length(image_urls) <= 8
    ),
  DROP CONSTRAINT IF EXISTS products_variants_array_check,
  ADD CONSTRAINT products_variants_array_check
    CHECK (
      jsonb_typeof(variants) = 'array'
      AND jsonb_array_length(variants) <= 24
    );

COMMIT;
