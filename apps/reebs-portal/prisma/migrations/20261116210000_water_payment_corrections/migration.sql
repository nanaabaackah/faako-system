-- Water-only audited collection corrections. Preserve original receipt facts.
-- New payments use the current reference uniqueness boundary; superseded
-- records stay immutable and visible, but cannot block a replacement reference.
ALTER TABLE "paymentRecord" ADD COLUMN "supersededAt" TIMESTAMPTZ;

DROP INDEX "paymentRecord_organization_providerReference_key";
CREATE UNIQUE INDEX "paymentRecord_organization_providerReference_key"
  ON "paymentRecord"("organizationId", "provider", LOWER("providerReference"))
  WHERE "providerReference" IS NOT NULL AND status = 'PAID' AND "supersededAt" IS NULL;

CREATE TABLE "waterPaymentCorrection" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES "organization"("id") ON DELETE RESTRICT,
  "productKey" TEXT NOT NULL,
  "saleId" INTEGER NOT NULL,
  "originalPaymentId" INTEGER REFERENCES "paymentRecord"("id") ON DELETE RESTRICT,
  "replacementPaymentId" INTEGER REFERENCES "paymentRecord"("id") ON DELETE RESTRICT,
  "correctionType" TEXT NOT NULL CHECK ("correctionType" IN ('REPLACED', 'REVERSED', 'LEGACY_CONFIRMED', 'LEGACY_UNPAID')),
  "previousSalePaymentStatus" TEXT,
  "reason" TEXT NOT NULL CHECK (length(trim("reason")) >= 5),
  "actorId" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "waterPaymentCorrection_original_distinct" CHECK ("originalPaymentId" IS NULL OR "originalPaymentId" IS DISTINCT FROM "replacementPaymentId")
);
CREATE UNIQUE INDEX "waterPaymentCorrection_org_key" ON "waterPaymentCorrection"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "waterPaymentCorrection_original_key" ON "waterPaymentCorrection"("organizationId", "originalPaymentId")
  WHERE "originalPaymentId" IS NOT NULL;
CREATE UNIQUE INDEX "waterPaymentCorrection_legacy_key" ON "waterPaymentCorrection"("organizationId", "saleId")
  WHERE "correctionType" IN ('LEGACY_CONFIRMED', 'LEGACY_UNPAID');
CREATE INDEX "waterPaymentCorrection_sale_history_idx"
  ON "waterPaymentCorrection"("organizationId", "productKey", "saleId", "createdAt" DESC);

ALTER TABLE "waterPaymentCorrection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterPaymentCorrection" FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON "waterPaymentCorrection" FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::integer)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::integer);
