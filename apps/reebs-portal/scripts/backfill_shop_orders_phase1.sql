-- REEBS shop Orders phase 1 backfill.
-- Run after prisma/migrations/20260504090000_shop_orders_phase1/migration.sql.
-- This script is idempotent and does not delete or overwrite payment/receipt history.

BEGIN;

UPDATE "order" o
SET
  "subtotalCents" = COALESCE(o."subtotalCents", o."total_amount"),
  "grandTotalCents" = COALESCE(o."grandTotalCents", o."total_amount"),
  "balanceDueCents" = CASE
    WHEN COALESCE(o."amountPaidCents", 0) > 0 THEN GREATEST(COALESCE(o."grandTotalCents", o."total_amount") - COALESCE(o."amountPaidCents", 0), 0)
    WHEN LOWER(COALESCE(o.status, '')) IN ('paid', 'fulfilled', 'completed', 'delivered') THEN 0
    ELSE COALESCE(o."grandTotalCents", o."total_amount")
  END,
  "amountPaidCents" = CASE
    WHEN COALESCE(o."amountPaidCents", 0) > 0 THEN o."amountPaidCents"
    WHEN LOWER(COALESCE(o.status, '')) IN ('paid', 'fulfilled', 'completed', 'delivered') THEN COALESCE(o."grandTotalCents", o."total_amount")
    ELSE 0
  END,
  "paymentStatus" = CASE
    WHEN LOWER(COALESCE(o.status, '')) IN ('refunded') THEN 'refunded'
    WHEN LOWER(COALESCE(o.status, '')) IN ('paid', 'fulfilled', 'completed', 'delivered') THEN 'paid'
    WHEN COALESCE(o."amountPaidCents", 0) > 0
      AND COALESCE(o."amountPaidCents", 0) < COALESCE(o."grandTotalCents", o."total_amount") THEN 'partially_paid'
    ELSE COALESCE(NULLIF(o."paymentStatus", ''), 'unpaid')
  END,
  "fulfillmentStatus" = CASE
    WHEN LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled') THEN 'cancelled'
    WHEN LOWER(COALESCE(o.status, '')) IN ('completed', 'fulfilled') THEN 'completed'
    WHEN LOWER(COALESCE(o.status, '')) = 'delivered' THEN 'delivered'
    WHEN LOWER(COALESCE(o.status, '')) = 'paid'
      AND LOWER(COALESCE(o."deliveryMethod", '')) LIKE '%pickup%' THEN 'picked_up'
    WHEN LOWER(COALESCE(o.status, '')) = 'paid' THEN 'preparing'
    ELSE COALESCE(NULLIF(o."fulfillmentStatus", ''), 'not_started')
  END,
  "fulfillmentMethod" = COALESCE(
    o."fulfillmentMethod",
    CASE
      WHEN LOWER(COALESCE(o."deliveryMethod", '')) LIKE '%delivery%' THEN 'Delivery'
      ELSE 'Pickup'
    END
  ),
  "deliveryRequired" = CASE
    WHEN LOWER(COALESCE(o."deliveryMethod", '')) LIKE '%delivery%' THEN TRUE
    ELSE FALSE
  END,
  "source" = COALESCE(o."source", 'Legacy Import'),
  "purchaseChannel" = COALESCE(o."purchaseChannel", 'Admin'),
  "expectedFulfillmentDate" = COALESCE(o."expectedFulfillmentDate", o."deliveryDate", o."orderDate"),
  "cancelledAt" = CASE
    WHEN o."cancelledAt" IS NULL
      AND LOWER(COALESCE(o.status, '')) IN ('cancelled', 'canceled') THEN COALESCE(o."lastModifiedAt", o."updatedAt")
    ELSE o."cancelledAt"
  END
WHERE o."total_amount" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "orderEvent" e
    WHERE e."organizationId" = o."organizationId"
      AND e."orderId" = o.id
      AND e.type = 'backfill'
  );

INSERT INTO "orderEvent" (
  "organizationId",
  "orderId",
  "type",
  "summary",
  "metadata",
  "createdAt"
)
SELECT
  o."organizationId",
  o.id,
  'backfill',
  'Legacy order normalized for shop order management.',
  jsonb_build_object(
    'legacyStatus', o.status,
    'legacyTotalAmount', o."total_amount",
    'paymentStatus', o."paymentStatus",
    'fulfillmentStatus', o."fulfillmentStatus",
    'source', 'scripts/backfill_shop_orders_phase1.sql'
  ),
  NOW()
FROM "order" o
WHERE NOT EXISTS (
  SELECT 1
  FROM "orderEvent" e
  WHERE e."organizationId" = o."organizationId"
    AND e."orderId" = o.id
    AND e.type = 'backfill'
);

COMMIT;
