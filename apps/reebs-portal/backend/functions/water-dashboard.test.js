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
      if (/^SELECT id, name, phone FROM "customer"/.test(statement)) {
        return { rows: [{ id: 1, name: "Water customer", phone: null }], rowCount: 1 };
      }
      if (/^SELECT .* FROM "water(?:Restock|Sale|Expense|Adjustment)" WHERE id =/.test(statement)) {
        assert.match(statement, /AND "productKey" = \$3/);
        const rows = statement.includes('FROM "waterRestock"') ? fixture.restocks : fixture.sales || [];
        const matches = rows.filter((row) => row.id === values[0]
          && (row.productKey || "gwater-15pk") === values[2]);
        return { rows: structuredClone(matches), rowCount: matches.length };
      }
      if (/^SELECT "unitCost" FROM "waterRestock"/.test(statement)) {
        const rows = fixture.restocks.filter((row) => row.productKey === values[1]
          && new Date(row.date) <= new Date(values[2]));
        return { rows: rows.slice(0, 1) };
      }
      if (/^INSERT INTO "waterSale"/.test(statement)) {
        const columns = [...statement.split("VALUES")[0].matchAll(/"([A-Za-z]+)"/g)].slice(1).map((match) => match[1]);
        const sale = { id: 12, ...Object.fromEntries(columns.map((column, index) => [column, values[index]])) };
        (fixture.sales ||= []).unshift(sale);
        return { rows: [{ id: sale.id }], rowCount: 1 };
      }
      if (/^INSERT INTO "waterExpense"/.test(statement)) {
        (fixture.expenses ||= []).push({ id: 30, organizationId: values[0], productKey: values[1],
          category: values[2], amount: values[3], description: values[4], date: values[6] });
        return { rows: [], rowCount: 1 };
      }
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
      if (/^UPDATE "waterRestock" SET/.test(statement)) {
        assert.match(statement, /AND "productKey" = \$9/);
        const row = fixture.restocks.find((row) => row.id === values[0] && row.productKey === values[8]);
        assert.ok(row);
        Object.assign(row, { quantity: values[2], unitCost: values[3], vendorId: values[4],
          vendorName: values[5], notes: values[6], date: values[7] });
        return { rows: [], rowCount: 1 };
      }
      if (/^UPDATE "waterSale" SET "quantity"/.test(statement)) {
        assert.match(statement, /AND "productKey" = \$26/);
        const row = fixture.sales.find((sale) => sale.id === values[0] && sale.productKey === values[25]);
        assert.ok(row);
        Object.assign(row, { quantity: values[2], unitPrice: values[9], standardUnitPrice: values[10],
          waterProductPriceId: values[11], unitCostAtSaleCents: values[12], totalAmount: values[16] });
        return { rows: [], rowCount: 1 };
      }
      if (/^SELECT COUNT\(\*\)::int AS count/.test(statement)) {
        return { rows: [{ count: 0 }] };
      }
      if (/^SELECT to_regclass/.test(statement)) return { rows: [{ table_ref: null }] };
      if (/^SELECT .* FROM "waterRestock" WHERE/.test(statement)) {
        assert.equal(values[0], 7);
        assert.match(statement, /AND "productKey" = \$2/);
        return { rows: fixture.restocks.filter((row) => (row.productKey || "gwater-15pk") === values[1]) };
      }
      if (/^SELECT .* FROM "waterSale" WHERE/.test(statement)) {
        assert.equal(values[0], 7);
        assert.match(statement, /AND "productKey" = \$2/);
        return { rows: (fixture.sales || []).filter((row) => (row.productKey || "gwater-15pk") === values[1]) };
      }
      if (/^SELECT .* FROM "water(?:Expense|Adjustment)" WHERE/.test(statement)) {
        assert.equal(values[0], 7);
        assert.match(statement, /AND "productKey" = \$2/);
        const rows = statement.includes('FROM "waterExpense"') ? fixture.expenses || [] : [];
        return { rows: rows.filter((row) => (row.productKey || "gwater-15pk") === values[1]) };
      }
      if (/^(?:CREATE TABLE|ALTER TABLE|UPDATE "waterSale"|WITH resolved_cost|BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory_xact_lock)/.test(statement)) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected fixture query: ${statement}`);
    }
  },
  resolvePrice: async (_client, options) => {
    fixture.priceRequests.push(options);
    if (fixture.missingPricing || fixture.missingPriceTypes?.includes(options.priceType)) {
      throw Object.assign(new Error("Water prices are not configured."), { statusCode: 503,
        code: options.priceType ? "MISSING_COMMERCIAL_CONFIGURATION" : "MISSING_WATER_PRICE" });
    }
    return { id: 1, currency: "GHS", priceCents: options.productKey === "sachet-water-30pk" ? 1200 : 3000, minimumQuantity: 10 };
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
    export const hasPermission = (user) => ["owner", "admin"].includes(user.role);
    export const respond = (_event, statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
  `],
  ["./_shared/requestRateLimit.js", `
    export const applyWindowRateLimit = async () => ({
      allowed: true, remaining: 100, retryAfterSeconds: 0, resetAt: "2026-09-24T12:00:00.000Z"
    });
  `],
  ["./_shared/auditLog.js", `
    export const getEventHeader = () => "";
    export const getEventIpAddress = () => null;
    export const writeAuditLog = async () => {};
  `],
  ["./_shared/commercialConfig.js", `
    export * from ${JSON.stringify(commercialUrl)};
    export const resolveWaterProductPrice = globalThis.${fixtureKey}.resolvePrice;
    export const resolveWaterSalePrice = globalThis.${fixtureKey}.resolvePrice;
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

const sachetProductKey = "sachet-water-30pk";
const sachetRestock = {
  id: 20, organizationId: 7, productKey: sachetProductKey,
  productName: "30pcs sachet water", quantity: 5, unitCost: 800,
  date: "2026-09-01T00:00:00.000Z",
};

const createFixture = (role) => ({
  role,
  queries: [],
  priceRequests: [],
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

test("missing company and bulk schedules do not hide the configured retail price", async () => {
  fixture = createFixture("admin");
  fixture.missingPriceTypes = ["COMPANY", "BULK_RETAIL"];
  const response = await handler({ httpMethod: "GET", headers: {} });
  assert.equal(response.statusCode, 200);
  const pricing = JSON.parse(response.body).product.pricing;
  assert.equal(pricing.retailSingle, 3000);
  assert.equal(pricing.retailMinimumQuantity, 10);
  assert.equal(pricing.retailBulk, null);
  assert.equal(pricing.company, null);
  assert.equal(pricing.configurationErrorCode, "MISSING_WATER_PRICE");
});

for (const role of ["owner", "admin", "water"]) {
  test(`${role} recorded-price correction with no historical schedule preserves cost and stock permissions`, async () => {
    fixture = createFixture(role);
    fixture.missingPricing = true;
    fixture.sales = [{ id: 9, productKey: "gwater-15pk", quantity: 2, saleChannel: "retail",
      date: "2026-09-02T14:30:00.000Z", updatedAt: "2026-09-02T14:30:00.000Z",
      unitPrice: 3000, standardUnitPrice: 3000, waterProductPriceId: 3,
      unitCostAtSaleCents: 2000, totalAmount: 6000, customerId: 1,
      paymentMethod: "cash", paymentStatus: "paid", discountType: "none", discountValue: 0 }];
    const response = await handler({ httpMethod: "POST", headers: {}, body: JSON.stringify({
      action: "update_sale", saleId: 9, unitPrice: "32.00", date: "2026-09-02",
    }) });
    assert.equal(response.statusCode, role === "water" ? 403 : 200, response.body);
    const sale = fixture.sales[0];
    assert.equal(sale.unitPrice, role === "water" ? 3000 : 3200);
    assert.equal(sale.totalAmount, role === "water" ? 6000 : 6400);
    assert.equal(sale.unitCostAtSaleCents, 2000);
    assert.equal(sale.standardUnitPrice, 3000);
    assert.equal(sale.waterProductPriceId, 3);
    assert.equal(sale.quantity, 2);
    if (role !== "water") assert.equal(fixture.queries.find(({ statement }) => /^UPDATE "waterSale" SET "quantity"/.test(statement)).values[21], "2026-09-02T14:30:00.000Z");
    assert.ok(fixture.priceRequests.every((request) => request.quantity === undefined), "no historical sale-price lookup for a price-only correction");
  });
}

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

test("30-piece pack dashboard isolates stock, prices and costs from the existing 15-pack", async () => {
  fixture = createFixture("admin");
  fixture.restocks.push(sachetRestock);
  fixture.sales = [{ id: 4, productKey: "gwater-15pk", quantity: 8, totalAmount: 24000,
    unitCostAtSaleCents: 2000, date: "2026-09-02" }];
  const dashboard = assertDashboard(await handler({ httpMethod: "GET",
    queryStringParameters: { productKey: sachetProductKey } }), "admin");
  assert.equal(dashboard.product.key, sachetProductKey);
  assert.equal(dashboard.product.packSize, 30);
  assert.equal(dashboard.product.purchaseCost, 800);
  assert.equal(dashboard.product.pricing.retailSingle, 1200);
  assert.equal(dashboard.summary.stockOnHand, 5);
  assert.equal(dashboard.summary.restockSpend, 4000);
  assert.deepEqual(dashboard.sales, []);
  assert.deepEqual(dashboard.restocks, [sachetRestock]);
  assert.ok(fixture.priceRequests.every((request) => request.productKey === sachetProductKey));
});

test("new 30-piece pack restock preserves legacy stock and records cost per whole pack", async () => {
  fixture = createFixture("admin");
  const legacy = structuredClone(fixture.restocks[0]);
  const dashboard = assertDashboard(await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "restock", productKey: sachetProductKey, quantity: 3, unitCost: "8.50", date: "2026-09-24",
  }) }), "admin");
  assert.equal(dashboard.summary.stockOnHand, 3);
  assert.equal(dashboard.summary.restockSpend, 2550);
  assert.equal(dashboard.restocks[0].productKey, sachetProductKey);
  assert.equal(dashboard.restocks[0].unitCost, 850);
  assert.deepEqual(fixture.restocks.find((row) => row.productKey === legacy.productKey), legacy);
  assert.ok(fixture.queries.some(({ values }) => values.includes(`water-inventory:7:${sachetProductKey}`)));
});

test("30-piece sale cannot consume available 15-pack stock", async () => {
  fixture = createFixture("water");
  const response = await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "sale", productKey: sachetProductKey, customerId: 1, quantity: 1,
    saleChannel: "retail", paymentMethod: "cash", date: "2026-09-24",
  }) });
  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error, /Not enough 30pcs sachet water/);
  assert.equal(fixture.queries.some(({ statement }) => statement.startsWith('INSERT INTO "waterSale"')), false);
});

test("Water staff sell whole sachet packs at their own price and cost snapshot", async () => {
  fixture = createFixture("water");
  fixture.restocks.push(sachetRestock);
  const dashboard = assertDashboard(await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "sale", productKey: sachetProductKey, customerId: 1, quantity: 2,
    saleChannel: "retail", paymentMethod: "cash", date: "2026-09-24",
  }) }), "water");
  assert.equal(dashboard.summary.stockOnHand, 3);
  assert.equal(dashboard.sales[0].totalAmount, 2400);
  assert.equal(dashboard.sales[0].productKey, sachetProductKey);
  assert.equal(fixture.sales[0].unitCostAtSaleCents, 800);
  assert.equal(Object.hasOwn(dashboard.sales[0], "unitCostAtSaleCents"), false);
  assert.equal(fixture.restocks[0].quantity, 10);
  assert.equal(dashboard.products.length, 2);
});

for (const action of ["update_restock", "delete_restock", "update_sale", "delete_sale"]) {
  test(`${action} cannot access a record belonging to the other Water product`, async () => {
    fixture = createFixture("admin");
    fixture.sales = [{ id: 1, productKey: "gwater-15pk", quantity: 1 }];
    const response = await handler({ httpMethod: "POST", body: JSON.stringify({
      action, productKey: sachetProductKey, restockId: 1, saleId: 1, quantity: 1,
    }) });
    assert.equal(response.statusCode, 404);
    assert.equal(fixture.restocks[0].quantity, 10);
    assert.equal(fixture.sales[0].quantity, 1);
  });
}

test("unconfigured sachet selling prices do not prevent stock recording or borrow legacy prices", async () => {
  fixture = { ...createFixture("admin"), missingPricing: true };
  const dashboard = assertDashboard(await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "restock", productKey: sachetProductKey, quantity: 3, unitCost: "8.50", date: "2026-09-24",
  }) }), "admin");
  assert.equal(dashboard.summary.stockOnHand, 3);
  assert.equal(dashboard.product.pricing.retailSingle, null);
  assert.match(dashboard.product.pricing.configurationError, /not configured/);
});

test("unknown product keys are rejected without touching the ledger", async () => {
  fixture = createFixture("admin");
  const response = await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "restock", productKey: "unknown-pack", quantity: 3, unitCost: "8.50",
  }) });
  assert.equal(response.statusCode, 400);
  assert.equal(JSON.parse(response.body).code, "INVALID_WATER_PRODUCT");
  assert.deepEqual(fixture.queries, []);
});

test("sachet expense is assigned only to the selected product's profit calculation", async () => {
  fixture = createFixture("admin");
  fixture.expenses = [{ id: 1, productKey: "gwater-15pk", amount: 3000, category: "Other", date: "2026-09-01" }];
  const dashboard = assertDashboard(await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "expense", productKey: sachetProductKey, category: "Transport", description: "Sachet delivery",
    amount: "5.00", date: "2026-09-24",
  }) }), "admin");
  assert.equal(dashboard.expenses.length, 1);
  assert.equal(dashboard.summary.extraExpenses, 500);
  assert.equal(dashboard.expenses[0].productKey, sachetProductKey);
  assert.equal(fixture.expenses[0].amount, 3000);
});

test("sachet sales fail closed without a configured price", async () => {
  fixture = { ...createFixture("water"), missingPricing: true };
  fixture.restocks.push(sachetRestock);
  const response = await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "sale", productKey: sachetProductKey, customerId: 1, quantity: 1,
    saleChannel: "retail", paymentMethod: "cash", date: "2026-09-24",
  }) });
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.body).code, "MISSING_WATER_PRICE");
  assert.match(JSON.parse(response.body).error, /Settings → Commercial/);
  assert.equal(fixture.queries.some(({ statement }) => statement.startsWith('INSERT INTO "waterSale"')), false);
  assert.ok(fixture.queries.some(({ statement }) => statement === "ROLLBACK"));
});

test("Water staff cannot record sachet purchase costs", async () => {
  fixture = createFixture("water");
  const response = await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "restock", productKey: sachetProductKey, quantity: 3, unitCost: "8.50", date: "2026-09-24",
  }) });
  assert.equal(response.statusCode, 403);
  assert.deepEqual(fixture.queries, []);
});

test("fractional packs are rejected rather than silently rounded", async () => {
  fixture = createFixture("admin");
  const response = await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "restock", productKey: sachetProductKey, quantity: 1.5, unitCost: "8.50", date: "2026-09-24",
  }) });
  assert.equal(response.statusCode, 400);
  assert.equal(fixture.queries.some(({ statement }) => statement.startsWith('INSERT INTO "waterRestock"')), false);
});

test("correcting an existing sachet restock cost leaves the 15-pack unchanged", async () => {
  fixture = createFixture("admin");
  fixture.restocks.push(structuredClone(sachetRestock));
  const legacy = structuredClone(fixture.restocks[0]);
  const dashboard = assertDashboard(await handler({ httpMethod: "POST", body: JSON.stringify({
    action: "update_restock", productKey: sachetProductKey, restockId: 20,
    unitCost: "9.00",
  }) }), "admin");
  assert.equal(dashboard.product.purchaseCost, 900);
  assert.equal(dashboard.summary.stockOnHand, 5);
  assert.deepEqual(fixture.restocks[0], legacy);
  const restatement = fixture.queries.find(({ statement }) => statement.startsWith("SELECT COUNT(*)::int AS count"));
  assert.deepEqual(restatement.values, [7, sachetProductKey]);
});
