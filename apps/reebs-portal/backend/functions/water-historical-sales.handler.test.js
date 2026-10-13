import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import { hasPermission } from "./_shared/internalApi.js";

const handlerUrl = new URL("./water.js", import.meta.url).href;
const key = "__waterHistoricalSalesFixture";
let state;
const price = (overrides = {}) => ({ id: 1, organizationId: 7, productKey: "gwater-15pk", productName: "15pk Gwater", priceType: "RETAIL", minimumQuantity: 1, priceCents: 3000, currency: "GHS", active: true, effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: "2026-09-01T00:00:00.000Z", ...overrides });
const rows = (records) => ({ rows: structuredClone(records), rowCount: records.length });
const query = async (sql, values = []) => {
  state.calls.push({ sql, values });
  if (/to_regclass/.test(sql)) return rows([{ table_ref: values[0].includes("water") ? values[0] : null }]);
  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql) || /pg_advisory|^(CREATE|ALTER)/.test(sql.trim())) return rows([]);
  if (/FROM "customer"/.test(sql)) return rows([{ id: 55, name: "Test customer" }]);
  if (/FROM "waterProductPrice"/.test(sql)) {
    const isTier = typeof values[2] === "number";
    return rows(state.prices.filter((row) => row.organizationId === values[0] && row.productKey === values[1]
      && (isTier ? ["RETAIL", "BULK_RETAIL"].includes(row.priceType) && row.minimumQuantity <= values[2] : row.priceType === values[2])
      && row.effectiveFrom <= values[3] && (!row.effectiveTo || row.effectiveTo > values[3])));
  }
  if (/FROM "commercialConfiguration"/.test(sql)) {
    assert.equal(values[1], "WATER");
    return rows([{ id: 10, organizationId: 7, businessUnit: "WATER", key: "water_discount_limit_bps", value: "1000", valueType: "BASIS_POINTS", effectiveFrom: "2026-01-01T00:00:00.000Z", active: true }]);
  }
  if (/FROM "waterRestock"/.test(sql)) {
    if (/SELECT "unitCost"/.test(sql)) assert.ok(values[2] >= "2026-01-01");
    return rows([{ id: 1, quantity: 200, unitCost: 2000, date: "2026-01-01" }]);
  }
  if (/FROM "waterSale"/.test(sql)) return rows(state.sales);
  if (/FROM "waterExpense"|FROM "waterAdjustment"|FROM "product"/.test(sql)) return rows([]);
  if (/INSERT INTO "waterSale"/.test(sql)) {
    const columns = sql.slice(sql.indexOf("(") + 1, sql.indexOf(") VALUES")).split(",").map((column) => column.trim().replaceAll('"', ""));
    state.sales.push({ id: 1, ...Object.fromEntries(columns.map((column, index) => [column, values[index]])) });
    return rows([{ id: 1 }]);
  }
  if (/UPDATE "waterSale"/.test(sql)) {
    const sale = state.sales.find((sale) => sale.id === values[0]);
    for (const match of sql.matchAll(/"(\w+)" = \$(\d+)/g)) {
      if (match.index < sql.indexOf("WHERE")) sale[match[1]] = values[Number(match[2]) - 1];
    }
    return rows([]);
  }
  state.unexpectedQuery = sql;
  throw new Error(`Unexpected isolated fixture query: ${sql}`);
};
globalThis[key] = {
  client: () => ({ connect: async () => {}, end: async () => {}, query }), hasPermission,
  auth: async () => ({ authUser: { id: 9, role: state.role }, organizationId: 7 }),
  audit: async (_client, data) => { state.audits.push(data); },
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === handlerUrl) {
    const source = {
      "./_shared/databaseClient.js": `export const createDatabaseClient = globalThis.${key}.client;`,
      "./_shared/internalApi.js": `export const hasPermission = globalThis.${key}.hasPermission; export const requireInternalUser = globalThis.${key}.auth; export const respond = (_event, statusCode, body) => ({statusCode, body: JSON.stringify(body)});`,
      "./_shared/requestRateLimit.js": "export const applyWindowRateLimit = async () => ({allowed: true});",
      "./_shared/auditLog.js": `export const writeAuditLog = globalThis.${key}.audit; export const getEventHeader = () => 'test-request'; export const getEventIpAddress = () => '127.0.0.1';`,
    }[specifier];
    if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { handler } = await import(handlerUrl);
after(() => { hooks.deregister(); delete globalThis[key]; });
const reset = () => { state = { calls: [], sales: [], audits: [], role: "admin", prices: [price(), price({ id: 2, priceType: "BULK_RETAIL", minimumQuantity: 20, priceCents: 2800 }), price({ id: 3, effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveTo: null, priceCents: 3500 }), price({ id: 4, priceType: "COMPANY", priceCents: 2500 })] }; };
const request = (payload) => handler({ httpMethod: "POST", body: JSON.stringify({ productKey: "gwater-15pk", ...payload }) });
const create = () => request({ action: "sale", customerId: 55, quantity: 10, date: "2026-07-20", saleChannel: "retail", paymentMethod: "cash", paymentStatus: "paid", discountType: "percent", discountValue: "5" });
const edit = (payload) => request({ action: "update_sale", saleId: 1, ...payload });
const assertSuccess = (response) => { assert.equal(response.statusCode, 200, state.unexpectedQuery || response.body); return JSON.parse(response.body); };

test("historical sale creation and retail/bulk/date/channel edits keep totals, cost, stock, payment and dashboard coherent", async () => {
  reset();
  assertSuccess(await create());
  assert.equal(state.sales[0].waterProductPriceId, 1);
  for (const [payload, unitPrice, priceId] of [
    [{ quantity: 19 }, 3000, 1], [{ quantity: 30 }, 2800, 2],
    [{ quantity: 10 }, 3000, 1], [{ saleChannel: "company" }, 2500, 4],
    [{ saleChannel: "retail", date: "2026-10-01" }, 3500, 3],
  ]) {
    const dashboard = assertSuccess(await edit(payload));
    const sale = state.sales[0];
    assert.equal(sale.unitPrice, unitPrice);
    assert.equal(sale.standardUnitPrice, unitPrice);
    assert.equal(sale.waterProductPriceId, priceId);
    assert.equal(sale.unitCostAtSaleCents, 2000);
    assert.equal(sale.discountAmount, sale.quantity * unitPrice * 0.05);
    assert.equal(sale.totalAmount, sale.quantity * unitPrice - sale.discountAmount);
    assert.equal(sale.paymentStatus, "paid");
    assert.ok(sale.paidAt);
    assert.equal(dashboard.summary.stockOnHand, 200 - sale.quantity);
    assert.equal(dashboard.summary.revenue, sale.totalAmount);
    assert.equal(dashboard.summary.cashCollected, sale.totalAmount);
    assert.equal(dashboard.summary.netProfit, sale.totalAmount - sale.quantity * 2000);
    assert.equal(dashboard.businessUnit, "WATER");
    assert.equal(dashboard.scope, "water");
  }
  assert.ok(state.audits.some((audit) => audit.action === "WATER_SALE_PRICE_RECALCULATED"));
  assert.ok(state.calls.filter(({ sql }) => /^(UPDATE|INSERT)/.test(sql.trim())).every(({ sql }) => /"waterSale"/.test(sql)));
});

test("missing historical price does not use current price; authorized price-only correction preserves old snapshots", async () => {
  reset();
  assertSuccess(await create());
  const snapshot = structuredClone(state.sales[0]);
  state.prices = state.prices.filter((row) => row.id === 3);
  const failedEdit = await edit({ quantity: 30 });
  assert.equal(failedEdit.statusCode, 503);
  assert.equal(JSON.parse(failedEdit.body).code, "MISSING_WATER_PRICE");
  assert.deepEqual(state.sales[0], snapshot);
  assert.equal((await create()).statusCode, 503);
  state.role = "water";
  assert.equal((await edit({ unitPrice: "29" })).statusCode, 403);
  assert.deepEqual(state.sales[0], snapshot);
  state.role = "admin";
  assertSuccess(await edit({ unitPrice: "29" }));
  assert.equal(state.sales[0].unitPrice, 2900);
  assert.equal(state.sales[0].standardUnitPrice, snapshot.standardUnitPrice);
  assert.equal(state.sales[0].waterProductPriceId, snapshot.waterProductPriceId);
  assert.equal(state.sales[0].unitCostAtSaleCents, snapshot.unitCostAtSaleCents);
});
