BEGIN;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS theme_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_theme_check,
  ADD CONSTRAINT stores_theme_check CHECK (theme IN (
    'clean',
    'fashion-editorial', 'fashion-collection',
    'beauty-ecrin', 'beauty-botanique',
    'tech-precision', 'tech-studio',
    'sport-stadium', 'sport-club',
    'jewelry-joaillerie', 'jewelry-atelier',
    'accessories-street', 'accessories-signature',
    'home-habitat', 'home-galerie',
    'grocery-marche', 'grocery-terroir',
    'food-menu', 'food-gourmand',
    'kids-douceur', 'kids-play',
    'auto-garage', 'auto-performance',
    'gifts-celebration', 'gifts-createur'
  )),
  DROP CONSTRAINT IF EXISTS stores_theme_settings_object_check,
  ADD CONSTRAINT stores_theme_settings_object_check
    CHECK (jsonb_typeof(theme_settings) = 'object');

COMMIT;
