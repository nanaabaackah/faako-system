-- Performance indexes identified by backend audit (2026-05-05).
-- All created CONCURRENTLY to avoid table locks on Railway.

-- stockMovement: time-series queries in stockActivity and orderStats velocity
-- scan the full table for a given org; (organizationId, date) makes these
-- index-only for the WHERE + GROUP BY.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "stockMovement_organizationId_date_idx"
  ON "stockMovement" ("organizationId", "date" DESC);

-- bookingItem: JOIN on bookingId in orderStats aggregations uses a seq scan
-- without this index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookingItem_bookingId_idx"
  ON "bookingItem" ("bookingId");

-- expense: fetchOrderDetail parallel query filters by (organizationId, orderId)
-- with no dedicated index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "expense_organizationId_orderId_idx"
  ON "expense" ("organizationId", "orderId")
  WHERE "orderId" IS NOT NULL;

-- maintenanceLog: orderStats cost queries filter by (organizationId) and date
-- range with no composite index.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "maintenanceLog_organizationId_createdAt_idx"
  ON "maintenanceLog" ("organizationId", "createdAt");
