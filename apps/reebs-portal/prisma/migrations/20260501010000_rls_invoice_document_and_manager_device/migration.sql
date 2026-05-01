DO $$
BEGIN
  IF to_regclass('"invoiceDocument"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "invoiceDocument" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "invoiceDocument" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS org_isolation ON "invoiceDocument"';
    EXECUTE
      'CREATE POLICY org_isolation ON "invoiceDocument"
         FOR ALL
         USING ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)
         WITH CHECK ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)';
  END IF;

  IF to_regclass('"inventoryEditRequest"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "inventoryEditRequest" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "inventoryEditRequest" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS org_isolation ON "inventoryEditRequest"';
    EXECUTE
      'CREATE POLICY org_isolation ON "inventoryEditRequest"
         FOR ALL
         USING ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)
         WITH CHECK ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)';
  END IF;

  IF to_regclass('"managerDevice"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE "managerDevice" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "managerDevice" FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS org_isolation ON "managerDevice"';
    EXECUTE 'DROP POLICY IF EXISTS allow_all_authed ON "managerDevice"';
    EXECUTE
      'CREATE POLICY org_isolation ON "managerDevice"
         FOR ALL
         USING ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)
         WITH CHECK ("organizationId" = current_setting(''app.current_organization_id'', true)::integer)';
  END IF;
END $$;
