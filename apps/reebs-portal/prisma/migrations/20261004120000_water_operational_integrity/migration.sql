-- Forward-only Water stabilization. No financial rows are rewritten or invented.
-- Review/apply in isolated staging BEFORE deploying the dependent API/UI.
CREATE TABLE IF NOT EXISTS "waterMutation" (
  "id" BIGSERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES "organization"(id),
  "productKey" TEXT NOT NULL,
  "actorId" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("organizationId", "idempotencyKey")
);
ALTER TABLE "waterMutation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterMutation" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "waterMutation"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);

-- These fields are absent from earlier Water migrations (sale update/archive
-- fields already exist and are deliberately not duplicated here).
ALTER TABLE "waterRestock"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "archivedByName" TEXT;
ALTER TABLE "waterExpense"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT;
ALTER TABLE "waterAdjustment"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "updatedByName" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER,
  ADD COLUMN IF NOT EXISTS "archivedByName" TEXT;

-- Keep immutable superseded price rows/references while permitting a reviewed
-- same-start replacement. The existing advisory lock still serializes windows.
CREATE UNIQUE INDEX IF NOT EXISTS "waterProductPrice_active_org_product_type_from_key"
  ON "waterProductPrice" ("organizationId", "productKey", "priceType", "effectiveFrom")
  WHERE active = true;
DROP INDEX IF EXISTS "waterProductPrice_org_product_type_from_key";
