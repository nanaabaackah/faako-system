-- Invoicing integrity foundation. Additive only: legacy documents remain readable
-- and payment histories are never inferred or rewritten by this migration.
BEGIN;

CREATE TABLE IF NOT EXISTS "invoiceDocument" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'manual',
  "sourceId" INTEGER,
  "customerId" INTEGER,
  "documentType" TEXT NOT NULL DEFAULT 'invoice',
  "title" TEXT,
  "invoiceNumber" TEXT,
  "issueDate" DATE,
  "dueDate" DATE,
  "paymentStatus" TEXT NOT NULL DEFAULT 'draft',
  "sentAt" TIMESTAMPTZ,
  "sentToEmail" TEXT,
  "stockCommittedAt" TIMESTAMPTZ,
  "depositAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "customerName" TEXT,
  "customerEmail" TEXT,
  "customerPhone" TEXT,
  "eventDate" DATE,
  "startTime" TEXT,
  "endTime" TEXT,
  "venueAddress" TEXT,
  "lineItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "expenses" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "additionalItems" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "notes" TEXT,
  "terms" TEXT,
  "taxRate" NUMERIC(8,4) NOT NULL DEFAULT 0,
  "discountAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "createdByUserId" INTEGER,
  "updatedByUserId" INTEGER,
  "archivedAt" TIMESTAMPTZ,
  "archivedByUserId" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "businessUnit" TEXT NOT NULL DEFAULT 'REEBS_CORE';
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GHS';
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "customerSnapshot" JSONB;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "sourceSnapshot" JSONB;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "financialSnapshot" JSONB;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "paymentStateVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMPTZ;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "issuedByUserId" INTEGER;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMPTZ;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "voidedByUserId" INTEGER;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "voidReason" TEXT;
ALTER TABLE "invoiceDocument" ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;

-- Fail before any backfill when a human must resolve historical number collisions.
-- The explicit transaction keeps a failed deploy recoverable and prevents a
-- partially-applied migration from blocking subsequent Prisma deploys.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "invoiceDocument"
    WHERE NULLIF(TRIM("invoiceNumber"), '') IS NOT NULL
    GROUP BY "organizationId", "invoiceNumber"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate invoice numbers exist. Run invoices:reconcile before applying this migration.'
      USING ERRCODE = '23505';
  END IF;
END $$;

-- Preserve legacy lifecycle semantics without claiming that old drafts were issued.
UPDATE "invoiceDocument"
SET "issuedAt" = COALESCE("sentAt", "updatedAt")
WHERE "issuedAt" IS NULL
  AND ("sentAt" IS NOT NULL OR LOWER(COALESCE("paymentStatus", 'draft')) <> 'draft');

CREATE TABLE IF NOT EXISTS "invoiceNumberSequence" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoiceNumberSequence_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoiceNumberSequence_document_type_check"
    CHECK ("documentType" IN ('invoice', 'receipt'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "invoiceNumberSequence_scope_key"
  ON "invoiceNumberSequence"("organizationId", "documentType", "year");
CREATE UNIQUE INDEX IF NOT EXISTS "invoiceDocument_number_key"
  ON "invoiceDocument"("organizationId", "invoiceNumber")
  WHERE "invoiceNumber" IS NOT NULL AND "invoiceNumber" <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "invoiceDocument_linked_unique_idx"
  ON "invoiceDocument"("organizationId", "sourceType", "sourceId")
  WHERE "sourceType" <> 'manual' AND "sourceId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "invoiceDocument_org_status_due_idx"
  ON "invoiceDocument"("organizationId", "paymentStatus", "dueDate");
CREATE INDEX IF NOT EXISTS "invoiceDocument_org_customer_created_idx"
  ON "invoiceDocument"("organizationId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "invoiceDocument_org_unit_issued_idx"
  ON "invoiceDocument"("organizationId", "businessUnit", "issuedAt");

DO $$ BEGIN
  ALTER TABLE "invoiceDocument" ADD CONSTRAINT "invoiceDocument_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoiceDocument" ADD CONSTRAINT "invoiceDocument_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoiceDocument" ADD CONSTRAINT "invoiceDocument_business_unit_check"
    CHECK ("businessUnit" IN ('REEBS_CORE', 'WATER')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "invoiceDocument" ADD CONSTRAINT "invoiceDocument_document_type_check"
    CHECK ("documentType" IN ('invoice', 'receipt')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "invoiceDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoiceDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "invoiceDocument";
CREATE POLICY org_isolation ON "invoiceDocument"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);

ALTER TABLE "invoiceNumberSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoiceNumberSequence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "invoiceNumberSequence";
CREATE POLICY org_isolation ON "invoiceNumberSequence"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);

COMMIT;
