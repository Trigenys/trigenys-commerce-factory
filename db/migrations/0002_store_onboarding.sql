BEGIN;

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS business_location text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS logo_url text;

ALTER TABLE stores
  DROP CONSTRAINT IF EXISTS stores_description_length_check,
  ADD CONSTRAINT stores_description_length_check
    CHECK (description IS NULL OR char_length(description) <= 280),
  DROP CONSTRAINT IF EXISTS stores_business_location_length_check,
  ADD CONSTRAINT stores_business_location_length_check
    CHECK (business_location IS NULL OR char_length(business_location) <= 180),
  DROP CONSTRAINT IF EXISTS stores_contact_email_length_check,
  ADD CONSTRAINT stores_contact_email_length_check
    CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  DROP CONSTRAINT IF EXISTS stores_theme_check,
  ADD CONSTRAINT stores_theme_check
    CHECK (theme IN ('clean')),
  DROP CONSTRAINT IF EXISTS stores_logo_url_check,
  ADD CONSTRAINT stores_logo_url_check
    CHECK (logo_url IS NULL OR logo_url ~ '^https://');

CREATE UNIQUE INDEX IF NOT EXISTS store_members_one_owner_store_idx
  ON store_members(auth_subject)
  WHERE role = 'owner';

COMMIT;
