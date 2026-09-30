-- Orders deep-dive: immutable REEBS-core commercial snapshots.
-- Apply per environment before deploying code that writes these columns.
-- Historical cost is intentionally not inferred from today's catalogue cost.

ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GHS',
  ADD COLUMN IF NOT EXISTS "taxCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "businessUnit" TEXT NOT NULL DEFAULT 'REEBS_CORE',
  ADD COLUMN IF NOT EXISTS "idempotencyFingerprint" TEXT;

ALTER TABLE "orderItem"
  ADD COLUMN IF NOT EXISTS "unitCostSnapshotCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "lineDiscountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "businessUnit" TEXT NOT NULL DEFAULT 'REEBS_CORE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_business_unit_check'
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_business_unit_check"
      CHECK ("businessUnit" = 'REEBS_CORE');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_commercial_amounts_nonnegative_check'
  ) THEN
    ALTER TABLE "order"
      ADD CONSTRAINT "order_commercial_amounts_nonnegative_check"
      CHECK (
        COALESCE("subtotalCents", 0) >= 0
        AND "discountCents" >= 0
        AND "deliveryFeeCents" >= 0
        AND "serviceFeeCents" >= 0
        AND "taxCents" >= 0
        AND COALESCE("grandTotalCents", "total_amount", 0) >= 0
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_item_business_unit_check'
  ) THEN
    ALTER TABLE "orderItem"
      ADD CONSTRAINT "order_item_business_unit_check"
      CHECK ("businessUnit" = 'REEBS_CORE');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_item_commercial_amounts_nonnegative_check'
  ) THEN
    ALTER TABLE "orderItem"
      ADD CONSTRAINT "order_item_commercial_amounts_nonnegative_check"
      CHECK (
        quantity > 0
        AND unit_price > 0
        AND total_amount > 0
        AND ("unitCostSnapshotCents" IS NULL OR "unitCostSnapshotCents" >= 0)
        AND "lineDiscountCents" >= 0
        AND "taxCents" >= 0
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "order_organizationId_businessUnit_orderDate_idx"
  ON "order" ("organizationId", "businessUnit", "orderDate" DESC);
