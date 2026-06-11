-- =============================================================================
-- Migration: Row-Level Security — tenant isolation
-- File:      migrations/rls_tenant_isolation.sql
-- Run as:   superuser / postgres role (bypasses RLS, so safe to apply)
-- =============================================================================
-- BEFORE RUNNING:
--   1. Run this script as the superuser (postgres / Supabase postgres role).
--   2. Create the limited app role (Section 1 below) and update DATABASE_URL
--      in your hosted API env to use the new reebs_app credentials.
--   3. After switching DATABASE_URL, verify queries still work before deploying.
-- =============================================================================

-- =============================================================================
-- SECTION 1: App role (run once, then update DATABASE_URL)
-- =============================================================================
-- Create a limited role that is subject to RLS.
-- The superuser (postgres) always bypasses RLS; reebs_app does not.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reebs_app') THEN
    -- !! NEVER commit a real password here. Set it out-of-band:
    --    ALTER ROLE reebs_app PASSWORD '<password-from-secret-manager>';
    CREATE ROLE reebs_app WITH LOGIN PASSWORD '<PLACEHOLDER_CHANGE_BEFORE_RUNNING>' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- Grant table-level access to reebs_app.
-- (Tables created after this migration also need GRANT — add to provisioning scripts.)
GRANT USAGE ON SCHEMA public TO reebs_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO reebs_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO reebs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO reebs_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO reebs_app;

-- =============================================================================
-- SECTION 2: Session-context helper
-- =============================================================================
-- set_org_context(org_id) — call once per connection/transaction to scope queries.
-- Example: SELECT set_org_context(1);

CREATE OR REPLACE FUNCTION set_org_context(p_org_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_org_id IS NULL OR p_org_id <= 0 THEN
    RAISE EXCEPTION 'set_org_context: invalid organizationId %', p_org_id;
  END IF;
  PERFORM set_config('app.current_organization_id', p_org_id::text, true);
END;
$$;

-- current_org_id() — used inside policy USING/WITH CHECK expressions.
-- Returns NULL when no org context is set (policy denies all rows).
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::integer;
$$;

-- =============================================================================
-- SECTION 3: Enable RLS + policies — tables with direct organizationId
-- =============================================================================
-- Pattern:
--   ENABLE ROW LEVEL SECURITY       — enforces policy for non-owner roles
--   FORCE ROW LEVEL SECURITY        — also enforces for the table owner
--   POLICY org_isolation ... USING  — limits SELECT / UPDATE / DELETE
--   POLICY org_isolation ... WITH CHECK — limits INSERT / UPDATE (new row)
-- =============================================================================

-- ---- organization ----
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_self ON "organization";
CREATE POLICY org_self ON "organization"
  FOR ALL
  USING (id = current_org_id())
  WITH CHECK (id = current_org_id());

-- ---- order ----
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "order";
CREATE POLICY org_isolation ON "order"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- orderItem ----
ALTER TABLE "orderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orderItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "orderItem";
CREATE POLICY org_isolation ON "orderItem"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- product ----
ALTER TABLE "product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "product";
CREATE POLICY org_isolation ON "product"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- sourceCategory ----
ALTER TABLE "sourceCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sourceCategory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "sourceCategory";
CREATE POLICY org_isolation ON "sourceCategory"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- specificCategory ----
ALTER TABLE "specificCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "specificCategory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "specificCategory";
CREATE POLICY org_isolation ON "specificCategory"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- inventoryVariant ----
ALTER TABLE "inventoryVariant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventoryVariant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "inventoryVariant";
CREATE POLICY org_isolation ON "inventoryVariant"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- stockMovement ----
ALTER TABLE "stockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stockMovement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "stockMovement";
CREATE POLICY org_isolation ON "stockMovement"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- user ----
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "user";
CREATE POLICY org_isolation ON "user"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- userSession ----
ALTER TABLE "userSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "userSession" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "userSession";
CREATE POLICY org_isolation ON "userSession"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- employeeProfile ----
ALTER TABLE "employeeProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employeeProfile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "employeeProfile";
CREATE POLICY org_isolation ON "employeeProfile"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- document ----
ALTER TABLE "document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "document";
CREATE POLICY org_isolation ON "document"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- vendor ----
ALTER TABLE "vendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "vendor";
CREATE POLICY org_isolation ON "vendor"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- maintenanceLog ----
ALTER TABLE "maintenanceLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "maintenanceLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "maintenanceLog";
CREATE POLICY org_isolation ON "maintenanceLog"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- timesheet ----
ALTER TABLE "timesheet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "timesheet" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "timesheet";
CREATE POLICY org_isolation ON "timesheet"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- expense ----
ALTER TABLE "expense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "expense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "expense";
CREATE POLICY org_isolation ON "expense"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- discount ----
ALTER TABLE "discount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "discount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "discount";
CREATE POLICY org_isolation ON "discount"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- customer ----
ALTER TABLE "customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "customer";
CREATE POLICY org_isolation ON "customer"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- booking ----
ALTER TABLE "booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "booking";
CREATE POLICY org_isolation ON "booking"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- bookingItem ----
ALTER TABLE "bookingItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bookingItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "bookingItem";
CREATE POLICY org_isolation ON "bookingItem"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- bouncyCastle ----
ALTER TABLE "bouncy_castles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bouncy_castles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "bouncy_castles";
CREATE POLICY org_isolation ON "bouncy_castles"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- indoorGame ----
ALTER TABLE "indoor_games" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "indoor_games" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "indoor_games";
CREATE POLICY org_isolation ON "indoor_games"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- machine ----
ALTER TABLE "machines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "machines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "machines";
CREATE POLICY org_isolation ON "machines"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- shopItem ----
ALTER TABLE "shop_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shop_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "shop_items";
CREATE POLICY org_isolation ON "shop_items"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- waterRestock ----
ALTER TABLE "waterRestock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterRestock" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "waterRestock";
CREATE POLICY org_isolation ON "waterRestock"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- waterSale ----
ALTER TABLE "waterSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterSale" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "waterSale";
CREATE POLICY org_isolation ON "waterSale"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- waterExpense ----
ALTER TABLE "waterExpense" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterExpense" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "waterExpense";
CREATE POLICY org_isolation ON "waterExpense"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- waterAdjustment ----
ALTER TABLE "waterAdjustment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "waterAdjustment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "waterAdjustment";
CREATE POLICY org_isolation ON "waterAdjustment"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- systemConfig ----
ALTER TABLE "systemConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "systemConfig" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "systemConfig";
CREATE POLICY org_isolation ON "systemConfig"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- chartOfAccount ----
ALTER TABLE "chartOfAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chartOfAccount" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "chartOfAccount";
CREATE POLICY org_isolation ON "chartOfAccount"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- taxRate ----
ALTER TABLE "taxRate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "taxRate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "taxRate";
CREATE POLICY org_isolation ON "taxRate"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- historicalImportBatch ----
ALTER TABLE "historicalImportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "historicalImportBatch" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "historicalImportBatch";
CREATE POLICY org_isolation ON "historicalImportBatch"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- journalEntry ----
ALTER TABLE "journalEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journalEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "journalEntry";
CREATE POLICY org_isolation ON "journalEntry"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- openingBalance ----
ALTER TABLE "openingBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "openingBalance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "openingBalance";
CREATE POLICY org_isolation ON "openingBalance"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- accountingManualSales ----
ALTER TABLE "accountingManualSales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accountingManualSales" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "accountingManualSales";
CREATE POLICY org_isolation ON "accountingManualSales"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- accountingConfig ----
ALTER TABLE "accountingConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accountingConfig" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "accountingConfig";
CREATE POLICY org_isolation ON "accountingConfig"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- websiteContent ----
ALTER TABLE "websiteContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "websiteContent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "websiteContent";
CREATE POLICY org_isolation ON "websiteContent"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- auditLog ----
-- auditLog.organizationId is nullable (can be NULL for system events).
-- Allow: rows whose org matches, OR rows with NULL org (system-level).
ALTER TABLE "auditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auditLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "auditLog";
CREATE POLICY org_isolation ON "auditLog"
  FOR ALL
  USING (
    "organizationId" IS NULL
    OR "organizationId" = current_org_id()
  )
  WITH CHECK (
    "organizationId" IS NULL
    OR "organizationId" = current_org_id()
  );

-- =============================================================================
-- SECTION 4: Tables without a direct organizationId (derived via JOIN)
-- =============================================================================

-- ---- delivery (scoped via booking) ----
-- No organizationId column; isolation enforced via booking FK.
ALTER TABLE "delivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "delivery";
CREATE POLICY org_isolation ON "delivery"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "booking" b
      WHERE b.id = "delivery"."bookingId"
        AND b."organizationId" = current_org_id()
    )
  );

-- ---- journalLine (scoped via journalEntry) ----
ALTER TABLE "journalLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journalLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "journalLine";
CREATE POLICY org_isolation ON "journalLine"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "journalEntry" je
      WHERE je.id = "journalLine"."journalEntryId"
        AND je."organizationId" = current_org_id()
    )
  );

-- ---- deferredRevenue (scoped via booking) ----
ALTER TABLE "deferredRevenue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deferredRevenue" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "deferredRevenue";
CREATE POLICY org_isolation ON "deferredRevenue"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "booking" b
      WHERE b.id = "deferredRevenue"."bookingId"
        AND b."organizationId" = current_org_id()
    )
  );

-- ---- revenueRecognitionLine (scoped via deferredRevenue → booking) ----
ALTER TABLE "revenueRecognitionLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "revenueRecognitionLine" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "revenueRecognitionLine";
CREATE POLICY org_isolation ON "revenueRecognitionLine"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM "deferredRevenue" dr
      JOIN "booking" b ON b.id = dr."bookingId"
      WHERE dr.id = "revenueRecognitionLine"."deferredRevenueId"
        AND b."organizationId" = current_org_id()
    )
  );

-- ---- invoiceDocument ----
ALTER TABLE "invoiceDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoiceDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "invoiceDocument";
CREATE POLICY org_isolation ON "invoiceDocument"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- inventoryEditRequest ----
ALTER TABLE "inventoryEditRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventoryEditRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "inventoryEditRequest";
CREATE POLICY org_isolation ON "inventoryEditRequest"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- ---- managerDevice ----
ALTER TABLE "managerDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "managerDevice" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "managerDevice";
DROP POLICY IF EXISTS allow_all_authed ON "managerDevice";
CREATE POLICY org_isolation ON "managerDevice"
  FOR ALL
  USING ("organizationId" = current_org_id())
  WITH CHECK ("organizationId" = current_org_id());

-- =============================================================================
-- SECTION 5: Verify
-- =============================================================================
-- After applying this migration you can verify with:
--
--   SET ROLE reebs_app;
--   SELECT set_org_context(1);
--   SELECT COUNT(*) FROM "order";          -- should return org 1 rows only
--   SELECT set_config('app.current_organization_id', '', true);
--   SELECT COUNT(*) FROM "order";          -- should return 0 (no context = denied)
--   RESET ROLE;
-- =============================================================================
