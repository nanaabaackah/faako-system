import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

// This handler test uses in-memory dependencies only. Never load local dotenv
// files or connect to the database configured for a developer's workspace.
process.env.REEBS_SKIP_ENV_FILES = "true";

let fixture;
const fixtureKey = "__reebsWaterDashboardTest";
globalThis[fixtureKey] = {
  Client: class {
    async connect() {}
    async end() { fixture.closed = true; }

    async query(sql, values = []) {
      assert.equal(fixture.closed, false, "dashboard reads must finish before closing the client");
      const statement = sql.replace(/\s+/g, " ").trim();
      fixture.queries.push({ statement, values });
      if (/^INSERT INTO "waterRestock"/.test(statement)) {
        fixture.restocks.unshift({
          id: 2,
          organizationId: values[0],
          productKey: values[1],
          productName: values[2],
          quantity: values[3],
          unitCost: values[4],
          vendorId: values[5],
          vendorName: values[6],
          notes: values[7],
          date: values[8],
          createdByUserId: values[9],
          createdByName: values[10],
        });
        return { rows: [], rowCount: 1 };
      }
      if (/^SELECT COUNT\(\*\)::int AS count/.test(statement)) {
        return { rows: [{ count: 0 }] };
      }
      if (/^SELECT to_regclass/.test(statement)) return { rows: [{ table_ref: null }] };
      if (/^SELECT .* FROM "waterRestock" WHERE/.test(statement)) {
        assert.deepEqual(values, [7]);
        return { rows: [...fixture.restocks] };
      }
      if (/^SELECT .* FROM "waterSale" WHERE/.test(statement)) {
        assert.deepEqual(values, [7]);
        return { rows: fixture.sales || [] };
      }
      if (/^SELECT .* FROM "water(?:Expense|Adjustment)" WHERE/.test(statement)) {
        assert.deepEqual(values, [7]);
        return { rows: [] };
      }
      if (/^(?:CREATE TABLE|ALTER TABLE|UPDATE "waterSale"|WITH resolved_cost|BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory_xact_lock)/.test(statement)) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected fixture query: ${statement}`);
    }
  },
  requireInternalUser: async (_client, _event, options) => {
    fixture.authorization = options;
    return {
      organizationId: 7,
      authUser: { id: 12, role: fixture.role, fullName: "Water test user" },
    };
  },
};

const commercialUrl = new URL("./_shared/commercialConfig.js", import.meta.url).href;
const mockedModules = new Map([
  ["./_shared/databaseClient.js", `
    export const createDatabaseClient = () => new globalThis.${fixtureKey}.Client();
  `],
  ["./_shared/internalApi.js", `
    export const requireInternalUser = globalThis.${fixtureKey}.requireInternalUser;
    export const hasPermission = () => false;
    export const respond = (_event, statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
  `],
  ["./_shared/requestRateLimit.js", `
    export const applyWindowRateLimit = async () => ({
      allowed: true, remaining: 100, retryAfterSeconds: 0, resetAt: "2026-09-24T12:00:00.000Z"
    });
  `],
  ["./_shared/commercialConfig.js", `
    export * from ${JSON.stringify(commercialUrl)};
    export const resolveWaterProductPrice = async () => ({
      currency: "GHS", priceCents: 3000, minimumQuantity: 10
    });
    export const resolveCommercialValue = async () => 1000;
  `],
]);

const handlerUrl = new URL("./water.js", import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === handlerUrl && mockedModules.has(specifier)) {
      return {
        url: `data:text/javascript,${encodeURIComponent(mockedModules.get(specifier))}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
let handler;
try {
  ({ handler } = await import(handlerUrl));
} finally {
  hooks.deregister();
}
after(() => { delete globalThis[fixtureKey]; });

const createFixture = (role) => ({
  role,
  queries: [],
  closed: false,
  restocks: [{
    id: 1,
    organizationId: 7,
    productKey: "gwater-15pk",
    productName: "15pk Gwater",
    quantity: 10,
    unitCost: 2000,
    date: "2026-09-01T00:00:00.000Z",
  }],
});

const assertDashboard = (response, role) => {
  assert.equal(response.statusCode, 200);
  const dashboard = JSON.parse(response.body);
  const allowed = role === "owner" || role === "admin";
  assert.deepEqual(dashboard.permissions, {
    canManagePricing: allowed,
    canOverridePrice: allowed,
    canViewCost: allowed,
    canViewFinance: allowed,
  });
  assert.equal(dashboard.scope, "water");
  assert.equal(dashboard.businessUnit, "WATER");
  assert.equal(fixture.closed, true);
  assert.deepEqual(fixture.authorization.roles, ["owner", "admin", "water"]);
  return dashboard;
};

for (const role of ["owner", "admin", "water"]) {
  test(`Water GET returns ${role} capabilities with its standalone dashboard`, async () => {
    fixture = createFixture(role);
    const dashboard = assertDashboard(await handler({ httpMethod: "GET", headers: {} }), role);
    assert.equal(fixture.authorization.permission, "water:read");
    assert.equal(dashboard.summary.stockOnHand, 10);
    if (role !== "water") {
      assert.equal(dashboard.summary.restockSpend, 20000);
      assert.equal(dashboard.product.purchaseCost, 2000);
    } else {
      assert.equal(Object.hasOwn(dashboard.product, "purchaseCost"), false);
      assert.equal(Object.hasOwn(dashboard.restocks[0], "unitCost"), false);
      assert.equal(Object.hasOwn(dashboard.summary, "restockSpend"), false);
      assert.equal(Object.hasOwn(dashboard.summary, "netProfit"), false);
    }
  });

  if (role === "water") continue;

  test(`Water restock response retains ${role} capabilities and entered cost`, async () => {
    fixture = createFixture(role);
    const response = await handler({
      httpMethod: "POST",
      headers: {},
      body: JSON.stringify({
        action: "restock",
        quantity: 4,
        unitCost: "24.50",
        date: "2026-09-24",
      }),
    });
    const dashboard = assertDashboard(response, role);
    assert.equal(fixture.authorization.permission, "water:write");
    assert.equal(dashboard.restocks[0].unitCost, 2450);
    assert.equal(dashboard.product.purchaseCost, 2450);
    assert.equal(dashboard.summary.stockOnHand, 14);
    assert.equal(dashboard.summary.restockSpend, 29800);
    assert.ok(fixture.queries.some(({ statement }) => statement === "COMMIT"));
    assert.ok(!fixture.queries.some(({ statement }) => statement === "ROLLBACK"));
  });
}

test("Water GET never supplies an invented purchase cost on an empty ledger", async () => {
  fixture = { ...createFixture("admin"), restocks: [] };
  const dashboard = assertDashboard(await handler({ httpMethod: "GET", headers: {} }), "admin");
  assert.equal(dashboard.product.purchaseCost, null);
  assert.equal(dashboard.summary.currentUnitCost, null);
});

test("Water GET exposes unknown historical profit without rewriting the ledger", async () => {
  fixture = { ...createFixture("admin"), sales: [
    { id: 1, quantity: 2, totalAmount: 6000, date: "2026-09-02" },
  ] };
  const dashboard = assertDashboard(await handler({ httpMethod: "GET", headers: {} }), "admin");
  assert.equal(dashboard.summary.netProfit, null);
  assert.equal(dashboard.summary.missingCostSaleCount, 1);
  assert.equal(fixture.queries.some(({ statement }) => /^UPDATE "waterSale"/.test(statement)), false);
});

for (const action of [
  "restock", "update_restock", "delete_restock", "expense", "update_expense",
  "delete_expense", "adjustment", "update_adjustment", "delete_adjustment", "update_product_pricing",
]) {
  test(`Water sales staff cannot bypass the UI to perform ${action}`, async () => {
    fixture = createFixture("water");
    const response = await handler({ httpMethod: "POST", body: JSON.stringify({
      action, quantity: 4, unitCost: "0.01", restockId: 1,
    }) });
    assert.equal(response.statusCode, 403);
    assert.equal(JSON.parse(response.body).code, "WATER_ACTION_FORBIDDEN");
    assert.deepEqual(fixture.queries, [], "forbidden actions must not even initialize or mutate Water tables");
    assert.equal(fixture.closed, true);
  });
}

test("Water operational response strips sale cost snapshots but retains sale editing data", async () => {
  fixture = createFixture("water");
  fixture.sales = [{ id: 3, quantity: 2, totalAmount: 6000, unitCostAtSaleCents: 2000,
    date: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-02T01:00:00.000Z" }];
  const dashboard = assertDashboard(await handler({ httpMethod: "GET" }), "water");
  assert.equal(dashboard.summary.stockOnHand, 8);
  assert.equal(dashboard.sales[0].totalAmount, 6000);
  assert.equal(dashboard.sales[0].updatedAt, fixture.sales[0].updatedAt);
  assert.equal(Object.hasOwn(dashboard.sales[0], "unitCostAtSaleCents"), false);
});

test("reading Water never rewrites historical payment status, references or paid dates", async () => {
  fixture = createFixture("admin");
  fixture.sales = [
    { id: 3, quantity: 1, totalAmount: 3000, paymentMethod: "momo", paymentStatus: "pending",
      paymentReference: "WATER-PENDING-3", paidAt: null, date: "2026-09-02T00:00:00Z" },
    { id: 4, quantity: 1, totalAmount: 3000, paymentMethod: "credit", paymentStatus: "paid",
      paymentReference: "WATER-COLLECTED-4", paidAt: "2026-09-03T00:00:00Z", date: "2026-09-02T00:00:00Z" },
  ];
  const dashboard = assertDashboard(await handler({ httpMethod: "GET" }), "admin");
  assert.deepEqual(dashboard.sales.map(({ paymentStatus, paymentReference, paidAt }) => ({
    paymentStatus, paymentReference, paidAt,
  })), fixture.sales.map(({ paymentStatus, paymentReference, paidAt }) => ({
    paymentStatus, paymentReference, paidAt,
  })));
  assert.equal(fixture.queries.some(({ statement }) => /^UPDATE "waterSale"/.test(statement)), false,
    "GET must not normalize or invent historical payment facts");
  assert.equal(dashboard.summary.cashCollected, 3000);
  assert.equal(dashboard.summary.pendingMomo, 3000);
  assert.equal(dashboard.summary.outstandingCredit, 0);
});
