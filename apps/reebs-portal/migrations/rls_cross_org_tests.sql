-- =============================================================================
-- RLS cross-organization access tests
-- Run as the reebs_app role (NOT superuser — superuser bypasses RLS).
-- All assertions must pass (i.e. return 0 rows when querying another org).
-- =============================================================================
-- Prerequisites:
--   1. rls_tenant_isolation.sql has been applied.
--   2. At least two organizations exist (id=1, id=2) with data in each.
--   3. Run as: SET ROLE reebs_app;
-- =============================================================================

SET ROLE reebs_app;

-- ── Test 1: No context → zero rows across primary tables ─────────────────────
SELECT set_config('app.current_organization_id', '', true);

DO $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM "order";
  ASSERT v_count = 0, FORMAT('FAIL Test 1a: expected 0 orders with no context, got %s', v_count);

  SELECT COUNT(*) INTO v_count FROM "booking";
  ASSERT v_count = 0, FORMAT('FAIL Test 1b: expected 0 bookings with no context, got %s', v_count);

  SELECT COUNT(*) INTO v_count FROM "customer";
  ASSERT v_count = 0, FORMAT('FAIL Test 1c: expected 0 customers with no context, got %s', v_count);

  SELECT COUNT(*) INTO v_count FROM "document";
  ASSERT v_count = 0, FORMAT('FAIL Test 1d: expected 0 documents with no context, got %s', v_count);

  SELECT COUNT(*) INTO v_count FROM "user";
  ASSERT v_count = 0, FORMAT('FAIL Test 1e: expected 0 users with no context, got %s', v_count);

  SELECT COUNT(*) INTO v_count FROM "invoiceDocument";
  ASSERT v_count = 0, FORMAT('FAIL Test 1f: expected 0 invoice documents with no context, got %s', v_count);

  RAISE NOTICE 'PASS Test 1: no context → zero rows';
END $$;

-- ── Test 2: Org 1 context → cannot see Org 2 rows ────────────────────────────
SELECT set_org_context(1);

DO $$
DECLARE
  v_count integer;
  v_org2_orders integer;
BEGIN
  -- Count orders that belong to org 2 visible from org 1 context
  SELECT COUNT(*) INTO v_org2_orders FROM "order" WHERE "organizationId" = 2;
  ASSERT v_org2_orders = 0,
    FORMAT('FAIL Test 2a: org 1 context can see %s org-2 orders', v_org2_orders);

  SELECT COUNT(*) INTO v_count FROM "booking" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2b: org 1 context can see %s org-2 bookings', v_count);

  SELECT COUNT(*) INTO v_count FROM "customer" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2c: org 1 context can see %s org-2 customers', v_count);

  SELECT COUNT(*) INTO v_count FROM "expense" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2d: org 1 context can see %s org-2 expenses', v_count);

  SELECT COUNT(*) INTO v_count FROM "document" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2e: org 1 context can see %s org-2 documents', v_count);

  SELECT COUNT(*) INTO v_count FROM "journalEntry" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2f: org 1 context can see %s org-2 journal entries', v_count);

  SELECT COUNT(*) INTO v_count FROM "invoiceDocument" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2g: org 1 context can see %s org-2 invoice documents', v_count);

  SELECT COUNT(*) INTO v_count FROM "inventoryEditRequest" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2h: org 1 context can see %s org-2 inventory edit requests', v_count);

  SELECT COUNT(*) INTO v_count FROM "managerDevice" WHERE "organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 2i: org 1 context can see %s org-2 manager devices', v_count);

  RAISE NOTICE 'PASS Test 2: org 1 cannot see org 2 rows';
END $$;

-- ── Test 3: Derived tables follow parent org ──────────────────────────────────
-- (delivery, journalLine, deferredRevenue, revenueRecognitionLine)

SELECT set_org_context(1);

DO $$
DECLARE v_count integer;
BEGIN
  -- delivery rows belonging to org-2 bookings must be invisible from org-1 context
  SELECT COUNT(*) INTO v_count
  FROM "delivery" d
  JOIN "booking" b ON b.id = d."bookingId"
  WHERE b."organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 3a: org 1 context can see %s org-2 deliveries', v_count);

  SELECT COUNT(*) INTO v_count
  FROM "journalLine" jl
  JOIN "journalEntry" je ON je.id = jl."journalEntryId"
  WHERE je."organizationId" = 2;
  ASSERT v_count = 0,
    FORMAT('FAIL Test 3b: org 1 context can see %s org-2 journal lines', v_count);

  RAISE NOTICE 'PASS Test 3: derived tables follow parent org isolation';
END $$;

-- ── Test 4: INSERT with wrong org is rejected ─────────────────────────────────
SELECT set_org_context(1);

DO $$
BEGIN
  BEGIN
    -- Attempt to insert an order for org 2 while context is org 1
    INSERT INTO "order" (
      "organizationId", "orderNumber", "customerId", "customerName",
      "status", "deliveryMethod", "total_amount", "orderDate"
    ) VALUES (2, 'TEST-CROSS', 1, 'Attacker', 'pending', 'delivery', 0, NOW());
    RAISE EXCEPTION 'FAIL Test 4: cross-org INSERT was NOT rejected';
  EXCEPTION
    WHEN check_violation OR others THEN
      RAISE NOTICE 'PASS Test 4: cross-org INSERT correctly rejected (%)', SQLERRM;
  END;
END $$;

-- ── Cleanup ───────────────────────────────────────────────────────────────────
RESET ROLE;
SELECT set_config('app.current_organization_id', '', true);
RAISE NOTICE 'All RLS tests complete.';
