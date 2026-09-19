-- Customer identity and relationship fields. This migration intentionally does
-- not rewrite historical Order/Booking/Water snapshots.
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "reference" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "customerType" TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "organizationName" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "contactPersonName" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "normalizedEmail" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "normalizedPhone" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "secondaryPhone" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "normalizedSecondaryPhone" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "addressLine2" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "locality" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "ghanaPostGps" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "preferredContactMethod" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "segmentOverride" TEXT;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "deletedByUserId" INTEGER;

UPDATE "customer"
SET "reference" = 'CUS-' || LPAD(id::text, 6, '0')
WHERE "reference" IS NULL OR BTRIM("reference") = '';

UPDATE "customer"
SET "normalizedEmail" = LOWER(BTRIM(email))
WHERE email IS NOT NULL
  AND BTRIM(email) <> ''
  AND "normalizedEmail" IS NULL;

UPDATE "customer"
SET "normalizedPhone" = CASE
  WHEN LENGTH(REGEXP_REPLACE(phone, '[^0-9]+', '', 'g')) = 10
       AND REGEXP_REPLACE(phone, '[^0-9]+', '', 'g') LIKE '0%'
    THEN '+233' || SUBSTRING(REGEXP_REPLACE(phone, '[^0-9]+', '', 'g') FROM 2)
  WHEN LENGTH(REGEXP_REPLACE(phone, '[^0-9]+', '', 'g')) = 12
       AND REGEXP_REPLACE(phone, '[^0-9]+', '', 'g') LIKE '233%'
    THEN '+' || REGEXP_REPLACE(phone, '[^0-9]+', '', 'g')
  ELSE NULL
END
WHERE phone IS NOT NULL
  AND BTRIM(phone) <> ''
  AND "normalizedPhone" IS NULL;

ALTER TABLE "customer" ALTER COLUMN "reference" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "customer_organizationId_reference_key"
  ON "customer" ("organizationId", "reference");
CREATE INDEX IF NOT EXISTS "customer_organizationId_normalizedEmail_idx"
  ON "customer" ("organizationId", "normalizedEmail");
CREATE INDEX IF NOT EXISTS "customer_organizationId_normalizedPhone_idx"
  ON "customer" ("organizationId", "normalizedPhone");
CREATE INDEX IF NOT EXISTS "customer_organizationId_name_idx"
  ON "customer" ("organizationId", name);
CREATE INDEX IF NOT EXISTS "customer_organizationId_customerType_deletedAt_idx"
  ON "customer" ("organizationId", "customerType", "deletedAt");

ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_type_check";
ALTER TABLE "customer"
  ADD CONSTRAINT "customer_type_check"
  CHECK ("customerType" IN ('individual', 'organization'));

ALTER TABLE "customer"
  DROP CONSTRAINT IF EXISTS "customer_preferred_contact_check";
ALTER TABLE "customer"
  ADD CONSTRAINT "customer_preferred_contact_check"
  CHECK ("preferredContactMethod" IS NULL OR "preferredContactMethod" IN ('phone', 'email', 'sms'));
