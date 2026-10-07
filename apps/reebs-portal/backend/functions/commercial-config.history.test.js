import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";
import { hasPermission, normalizeRole } from "./_shared/internalApi.js";
import { resolveWaterSalePrice } from "./_shared/commercialConfig.js";

const handlerUrl = new URL("./commercial-config.js", import.meta.url).href;
const key = "__waterPriceHistoryFixture";
let state;
const price = (overrides = {}) => ({
  id: 1, organizationId: 7, productId: null, productKey: "gwater-15pk",
  productName: "15pk Gwater", priceType: "RETAIL", minimumQuantity: 1,
  priceCents: 3000, currency: "GHS", active: true,
  effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, ...overrides,
});
const query = async (sql, values = []) => {
  state.calls.push({ sql, values });
  if (/SELECT.*pg_advisory|^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
  if (/FROM "waterProductPrice"/.test(sql)) {
    assert.equal(values[0], 7);
    let rows = state.prices.filter((row) => row.active && row.organizationId === values[0] && row.productKey === values[1]);
    if (/FOR UPDATE/.test(sql)) rows = rows.filter((row) => row.priceType === values[2]);
    else {
      assert.match(sql, /"minimumQuantity" <= \$3/);
      rows = rows.filter((row) => ["RETAIL", "BULK_RETAIL"].includes(row.priceType)
        && row.minimumQuantity <= values[2] && row.effectiveFrom <= values[3]
        && (!row.effectiveTo || row.effectiveTo > values[3]));
    }
    return { rows: structuredClone(rows), rowCount: rows.length };
  }
  if (/UPDATE "waterProductPrice"/.test(sql)) {
    const row = state.prices.find((row) => row.id === values[0]);
    if (/SET active = false/.test(sql)) row.active = false;
    else row.effectiveTo = values[1];
    return { rows: [] };
  }
  if (/INSERT INTO "waterProductPrice"/.test(sql)) {
    const names = ["organizationId", "productId", "productKey", "productName", "priceType", "minimumQuantity", "priceCents", "currency", "effectiveFrom", "effectiveTo", "description", "createdByUserId"];
    const row = price({ id: ++state.nextId, ...Object.fromEntries(names.map((name, i) => [name, values[i]])) });
    state.prices.push(row);
    return { rows: [structuredClone(row)] };
  }
  throw new Error(`Unexpected query in isolated fixture: ${sql}`);
};
globalThis[key] = {
  client: () => ({ connect: async () => {}, end: async () => {}, query }),
  auth: async () => ({ authUser: { id: 9, role: state.role }, organizationId: 7 }),
  hasPermission, normalizeRole,
  audit: async (_client, data) => { state.audit = data; },
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === handlerUrl) {
    const source = {
      pg: `export class Client { constructor() { return globalThis.${key}.client(); } }`,
      "./_shared/internalApi.js": `export const {hasPermission, normalizeRole} = globalThis.${key}; export const requireInternalUser = globalThis.${key}.auth; export const respond = (_event, statusCode, body) => ({statusCode, body: JSON.stringify(body)});`,
      "./_shared/auditLog.js": `export const writeAuditLog = globalThis.${key}.audit; export const getEventHeader = () => 'test-request'; export const getEventIpAddress = () => '127.0.0.1';`,
    }[specifier];
    if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { handler } = await import(handlerUrl);
after(() => { hooks.deregister(); delete globalThis[key]; });
const reset = (prices = [], role = "admin") => { state = { prices: structuredClone(prices), role, calls: [], nextId: 100 }; };
const request = (overrides = {}) => handler({ httpMethod: "POST", body: JSON.stringify({
  resourceType: "water_price", organizationId: 999, productKey: "gwater-15pk",
  productName: "15pk Gwater", priceType: "RETAIL", minimumQuantity: 1,
  priceCents: 2800, currency: "GHS", effectiveFrom: "2026-03-01T00:00:00.000Z", ...overrides,
}) });
const resolve = (at) => resolveWaterSalePrice({ query }, { organizationId: 7, productKey: "gwater-15pk", saleChannel: "retail", quantity: 10, at });

test("historical Water insert splits a window, preserves both sides, audits and never writes sale snapshots", async () => {
  reset([price()]);
  const response = await request({ effectiveTo: "2026-06-01T00:00:00.000Z" });
  assert.equal(response.statusCode, 201, response.body);
  assert.equal((await resolve("2026-02-01")).priceCents, 3000);
  assert.equal((await resolve("2026-03-01")).priceCents, 2800);
  assert.equal((await resolve("2026-06-01")).priceCents, 3000);
  assert.equal(state.prices.find((row) => row.id === 1).effectiveTo, "2026-03-01T00:00:00.000Z");
  assert.equal(state.audit.userId, 9);
  assert.equal(state.audit.organizationId, 7);
  assert.deepEqual(Object.fromEntries(["productKey", "priceType", "minimumQuantity", "priceCents", "scheduleType"].map((key) => [key, state.audit.metadata[key]])), {
    productKey: "gwater-15pk", priceType: "RETAIL", minimumQuantity: 1, priceCents: 2800, scheduleType: "historical",
  });
  assert.ok(state.calls.some(({ sql }) => sql === "COMMIT"));
  assert.ok(state.calls.every(({ sql }) => !/waterSale|waterRestock|commercialConfiguration|DELETE/.test(sql)));
});

test("an open-ended historical insert preserves the later schedule and unrelated product/tenant/tier", async () => {
  const future = price({ id: 2, effectiveFrom: "2099-09-01T00:00:00.000Z", priceCents: 3500 });
  const unrelated = [price({ id: 3, organizationId: 8 }), price({ id: 4, productKey: "sachet-water-30pk" }), price({ id: 5, priceType: "BULK_RETAIL", minimumQuantity: 20 })];
  reset([price({ effectiveTo: future.effectiveFrom }), future, ...unrelated]);
  const response = await request();
  assert.equal(response.statusCode, 201);
  assert.equal(JSON.parse(response.body).record.effectiveTo, future.effectiveFrom);
  assert.deepEqual(state.prices.find((row) => row.id === 2), future);
  for (const row of unrelated) assert.deepEqual(state.prices.find((record) => record.id === row.id), row);
});

test("explicit end crossing a later schedule fails without mutation", async () => {
  const prices = [price({ effectiveFrom: "2026-09-01T00:00:00.000Z" })];
  reset(prices);
  const response = await request({ effectiveTo: "2026-10-01T00:00:00.000Z" });
  assert.equal(response.statusCode, 409);
  assert.deepEqual(state.prices, prices);
  assert.ok(state.calls.some(({ sql }) => sql === "ROLLBACK"));
});

test("owner/admin only; ordinary Water staff cannot insert historical prices", async () => {
  for (const role of ["owner", "admin", "water", "manager", "staff"]) {
    reset([], role);
    const response = await request();
    assert.equal(response.statusCode, ["owner", "admin"].includes(role) ? 201 : 403);
    if (response.statusCode === 403) assert.equal(state.calls.length, 0);
  }
});

test("September open-ended replacement closes January without deleting its record", async () => {
  reset([price()]);
  const response = await request({ effectiveFrom: "2026-09-01T00:00:00.000Z", priceCents: 3500 });
  assert.equal(response.statusCode, 201);
  assert.equal((await resolve("2026-07-20")).priceCents, 3000);
  assert.equal((await resolve("2026-10-10")).priceCents, 3500);
  assert.equal(state.prices.length, 2);
  assert.equal(state.prices[0].id, 1);
  assert.equal(state.prices[0].effectiveTo, "2026-09-01T00:00:00.000Z");
});

test("a historical gap can be filled without altering the older or later records", async () => {
  const prices = [price({ effectiveTo: "2026-03-01T00:00:00.000Z" }), price({ id: 2, effectiveFrom: "2026-06-01T00:00:00.000Z" })];
  reset(prices);
  assert.equal((await request()).statusCode, 201);
  for (const previous of prices) assert.deepEqual(state.prices.find((row) => row.id === previous.id), previous);
  assert.equal((await resolve("2026-05-01")).priceCents, 2800);
  assert.equal((await resolve("2026-06-01")).priceCents, 3000);
});
