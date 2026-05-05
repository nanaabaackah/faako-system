-- REEBS shop Orders phase 1: additive schema only.
-- Existing legacy order rows and APIs continue to work until the backend phase.

ALTER TABLE "order"
ADD COLUMN IF NOT EXISTS "linkedBookingId" INTEGER,
ADD COLUMN IF NOT EXISTS "source" TEXT,
ADD COLUMN IF NOT EXISTS "purchaseChannel" TEXT,
ADD COLUMN IF NOT EXISTS "fulfillmentMethod" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryRequired" BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS "isPosOrder" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "expectedFulfillmentDate" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "subtotalCents" INTEGER,
ADD COLUMN IF NOT EXISTS "discountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "serviceFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "grandTotalCents" INTEGER,
ADD COLUMN IF NOT EXISTS "amountPaidCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "balanceDueCents" INTEGER,
ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS "cancelReason" TEXT,
ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "order_organizationId_idempotencyKey_key"
  ON "order" ("organizationId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "order_organizationId_orderDate_idx" ON "order" ("organizationId", "orderDate");
CREATE INDEX IF NOT EXISTS "order_organizationId_paymentStatus_idx" ON "order" ("organizationId", "paymentStatus");
CREATE INDEX IF NOT EXISTS "order_organizationId_fulfillmentStatus_idx" ON "order" ("organizationId", "fulfillmentStatus");
CREATE INDEX IF NOT EXISTS "order_organizationId_source_idx" ON "order" ("organizationId", "source");
CREATE INDEX IF NOT EXISTS "order_linkedBookingId_idx" ON "order" ("linkedBookingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_linkedBookingId_fkey'
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_linkedBookingId_fkey"
      FOREIGN KEY ("linkedBookingId")
      REFERENCES "booking" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "orderPayment" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL DEFAULT 1,
  "orderId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "provider" TEXT,
  "transactionReference" TEXT,
  "phoneNumber" TEXT,
  "confirmationStatus" TEXT,
  "status" TEXT NOT NULL DEFAULT 'successful',
  "paidAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "recordedByUserId" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "orderPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orderPayment_amountCents_nonnegative" CHECK ("amountCents" >= 0),
  CONSTRAINT "orderPayment_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orderPayment_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orderPayment_customerId_fkey" FOREIGN KEY ("customerId")
    REFERENCES "customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "orderPayment_organizationId_orderId_idx" ON "orderPayment" ("organizationId", "orderId");
CREATE INDEX IF NOT EXISTS "orderPayment_organizationId_customerId_idx" ON "orderPayment" ("organizationId", "customerId");
CREATE INDEX IF NOT EXISTS "orderPayment_organizationId_paidAt_idx" ON "orderPayment" ("organizationId", "paidAt");

CREATE TABLE IF NOT EXISTS "orderReceipt" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL DEFAULT 1,
  "receiptNumber" TEXT NOT NULL,
  "orderId" INTEGER NOT NULL,
  "paymentId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "pdfDocumentId" INTEGER,
  "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "issuedByUserId" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "orderReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orderReceipt_amountCents_nonnegative" CHECK ("amountCents" >= 0),
  CONSTRAINT "orderReceipt_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orderReceipt_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orderReceipt_paymentId_fkey" FOREIGN KEY ("paymentId")
    REFERENCES "orderPayment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orderReceipt_customerId_fkey" FOREIGN KEY ("customerId")
    REFERENCES "customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orderReceipt_pdfDocumentId_fkey" FOREIGN KEY ("pdfDocumentId")
    REFERENCES "document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "orderReceipt_organizationId_receiptNumber_key"
  ON "orderReceipt" ("organizationId", "receiptNumber");
CREATE INDEX IF NOT EXISTS "orderReceipt_organizationId_orderId_idx" ON "orderReceipt" ("organizationId", "orderId");
CREATE INDEX IF NOT EXISTS "orderReceipt_organizationId_paymentId_idx" ON "orderReceipt" ("organizationId", "paymentId");
CREATE INDEX IF NOT EXISTS "orderReceipt_organizationId_issuedAt_idx" ON "orderReceipt" ("organizationId", "issuedAt");

CREATE TABLE IF NOT EXISTS "orderEvent" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL DEFAULT 1,
  "orderId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "summary" TEXT,
  "metadata" JSONB,
  "createdByUserId" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "orderEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orderEvent_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "orderEvent_orderId_fkey" FOREIGN KEY ("orderId")
    REFERENCES "order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "orderEvent_organizationId_orderId_createdAt_idx" ON "orderEvent" ("organizationId", "orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "orderEvent_organizationId_type_createdAt_idx" ON "orderEvent" ("organizationId", "type", "createdAt");

ALTER TABLE "stockMovement"
ADD COLUMN IF NOT EXISTS "orderId" INTEGER,
ADD COLUMN IF NOT EXISTS "orderItemId" INTEGER;

CREATE INDEX IF NOT EXISTS "stockMovement_orderId_idx" ON "stockMovement" ("orderId");
CREATE INDEX IF NOT EXISTS "stockMovement_orderItemId_idx" ON "stockMovement" ("orderItemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stockMovement_orderId_fkey'
  ) THEN
    ALTER TABLE "stockMovement"
      ADD CONSTRAINT "stockMovement_orderId_fkey"
      FOREIGN KEY ("orderId")
      REFERENCES "order" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stockMovement_orderItemId_fkey'
  ) THEN
    ALTER TABLE "stockMovement"
      ADD CONSTRAINT "stockMovement_orderItemId_fkey"
      FOREIGN KEY ("orderItemId")
      REFERENCES "orderItem" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"orderPayment"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "orderPayment" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "orderPayment" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS org_isolation ON "orderPayment"';
    EXECUTE
      'CREATE POLICY org_isolation ON "orderPayment"
         FOR ALL
         USING ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)
         WITH CHECK ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)';
  END IF;

  IF to_regclass('"orderReceipt"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "orderReceipt" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "orderReceipt" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS org_isolation ON "orderReceipt"';
    EXECUTE
      'CREATE POLICY org_isolation ON "orderReceipt"
         FOR ALL
         USING ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)
         WITH CHECK ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)';
  END IF;

  IF to_regclass('"orderEvent"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "orderEvent" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "orderEvent" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS org_isolation ON "orderEvent"';
    EXECUTE
      'CREATE POLICY org_isolation ON "orderEvent"
         FOR ALL
         USING ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)
         WITH CHECK ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)';
  END IF;
END $$;
