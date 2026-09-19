import assert from "node:assert/strict";
import test from "node:test";
import { listCorePayments } from "./paymentRepository.js";

test("payment register is paginated and explicitly excludes Water", async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("set_config('app.current_organization_id'")) return { rows: [], rowCount: 1 };
      if (sql.includes("to_regclass")) return { rows: [{ available: false }], rowCount: 1 };
      if (sql.includes("COUNT(*)")) return { rows: [{ count: 1 }], rowCount: 1 };
      return {
        rows: [{
          id: 4,
          orderId: 8,
          orderNumber: "ORD-8",
          customerId: 2,
          customerName: "Customer",
          amountCents: 6000,
          method: "Cash",
          confirmationStatus: "manual_recorded",
          status: "successful",
          currency: "GHS",
        }],
        rowCount: 1,
      };
    },
  };
  const result = await listCorePayments(client, {
    organizationId: 1,
    query: { page: 2, pageSize: 10, q: "ORD-8", method: "mobile_money" },
  });
  assert.equal(result.businessUnit, "REEBS_CORE");
  assert.equal(result.items[0].paymentReference, "REEBS-PAY-000004");
  assert.equal(result.pagination.page, 2);
  assert.match(queries[2].sql, /businessUnit/);
  assert.match(queries[2].sql, /REEBS_CORE/);
  assert.match(queries[2].sql, /mobilemoney/);
  assert.deepEqual(queries[3].params.slice(-2), [10, 10]);
});

test("migrated register uses universal Core payments and excludes linked legacy duplicates", async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("set_config('app.current_organization_id'")) return { rows: [] };
      if (sql.includes("to_regclass")) return { rows: [{ available: true }] };
      if (sql.includes("COUNT(*)")) return { rows: [{ count: 1 }] };
      return { rows: [{
        rowKey: "payment:2",
        id: 2,
        paymentReference: "REEBS-PAY-O1-ABC",
        amountCents: 1000,
        currency: "GHS",
        method: "Mobile Money",
        verificationStatus: "VERIFIED",
        source: "ONLINE_PROVIDER",
        status: "PAID",
        businessUnit: "REEBS_CORE",
        customerId: 4,
        customerName: "Ama",
        payableType: "BOOKING",
        payableId: 7,
        payableReference: "BK-7",
      }] };
    },
  };
  const result = await listCorePayments(client, { organizationId: 1, query: {} });
  assert.equal(result.items[0].relatedRecord.type, "BOOKING");
  assert.equal(result.items[0].businessUnit, "REEBS_CORE");
  assert.match(queries[2].sql, /NOT EXISTS/);
  assert.match(queries[2].sql, /paymentApplication/);
  assert.doesNotMatch(queries[2].sql, /WATER_ORDER' AS/);
});
