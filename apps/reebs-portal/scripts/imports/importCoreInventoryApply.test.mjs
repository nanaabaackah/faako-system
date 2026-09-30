import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

// All runtime/driver imports are replaced: these tests cannot reach a database
// or load environment files, including when run with the whole Node test suite.
const importerUrl = new URL("./importCoreInventoryCsv.mjs", import.meta.url).href;
const key = "__stagingInventoryImportFixture";
let state;
globalThis[key] = class Client {
  async connect() { state.connections += 1; }
  async end() { state.closed += 1; }
  async query(sql, values = []) {
    state.calls.push({ sql, values });
    if (sql.startsWith("SELECT id FROM organization")) return { rowCount: 1, rows: [{ id: 7 }] };
    if (sql.includes('INSERT INTO "product"')) return state.existing
      ? { rowCount: 0, rows: [] } : { rowCount: 1, rows: [{ id: 88 }] };
    if (sql.startsWith('SELECT id FROM "product"')) return { rows: [{ id: 88 }] };
    if (sql.startsWith('SELECT sku, stock FROM "product"')) return { rows: state.stockRows || [] };
    if (sql.includes('INSERT INTO "stockMovement"')) {
      if (state.fail) throw Object.assign(new Error("Fixture schema failure"), { code: "42703" });
      return { rowCount: 1, rows: [] };
    }
    if (["BEGIN", "BEGIN READ ONLY", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    throw new Error("Unexpected import query");
  }
};
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === importerUrl && specifier === "../../runtimeEnv.js") {
    return { url: 'data:text/javascript,export const DATABASE_URL="postgresql://fixture.invalid/staging"; export const resolvePgSslConfig=()=>false;', shortCircuit: true };
  }
  if (context.parentURL === importerUrl && specifier === "pg") {
    return { url: `data:text/javascript,export const Client=globalThis.${key};`, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { applyCoreInventoryPlan, checkCoreInventoryPlan } = await import(importerUrl);
after(() => { hooks.deregister(); delete globalThis[key]; });

const product = { sku: "TEST-001", name: "Fixture", sourceCategoryCode: "RENTAL", stock: 3, price: 100, currency: "GHS", isActive: true };
function reset(extra = {}) {
  state = { connections: 0, closed: 0, calls: [], ...extra };
  process.env.APP_ENV = "staging";
  process.env.RAILWAY_ENVIRONMENT_NAME = "staging";
  process.env.REEBS_PUBLIC_ORGANIZATION_ID = "7";
  process.argv = [process.execPath, "test", "--apply", "--confirm-staging"];
}

test("staging inventory import refuses production/mismatched environments before connecting", async () => {
  for (const [app, railway] of [["production", "production"], ["staging", "production"], ["production", "staging"], ["development", "staging"]]) {
    reset();
    process.env.APP_ENV = app;
    process.env.RAILWAY_ENVIRONMENT_NAME = railway;
    await assert.rejects(applyCoreInventoryPlan([product]), /must both be staging/);
    assert.equal(state.connections, 0);
  }
});

test("staging inventory import requires an explicit organization and confirmation", async () => {
  reset();
  process.env.REEBS_PUBLIC_ORGANIZATION_ID = "0";
  await assert.rejects(applyCoreInventoryPlan([product]), /positive integer/);
  reset();
  process.argv = [process.execPath, "test", "--apply"];
  await assert.rejects(applyCoreInventoryPlan([product]), /confirm-staging/);
  assert.equal(state.connections, 0);
});

test("new staging stock is inserted atomically with an organization-scoped opening movement", async () => {
  reset();
  const result = await applyCoreInventoryPlan([product]);
  assert.equal(result.createdProducts, 1);
  assert.equal(result.openingMovements, 1);
  const movement = state.calls.find(({ sql }) => sql.includes('INSERT INTO "stockMovement"'));
  assert.deepEqual(movement.values.slice(0, 3), [7, 88, 3]);
  assert.equal(state.calls.at(-1).sql, "COMMIT");
  assert.equal(state.closed, 1);
});

test("existing product stock is not overwritten or counted again on rerun", async () => {
  reset({ existing: true });
  const result = await applyCoreInventoryPlan([product]);
  assert.equal(result.existingProducts, 1);
  assert.equal(result.openingMovements, 0);
  assert.ok(state.calls.every(({ sql }) => !/UPDATE|DELETE|TRUNCATE|stockMovement/.test(sql)));
});

test("an import failure rolls back instead of committing a partial stock load", async () => {
  reset({ fail: true });
  await assert.rejects(applyCoreInventoryPlan([product]), { code: "42703" });
  assert.equal(state.calls.at(-1).sql, "ROLLBACK");
  assert.ok(state.calls.every(({ sql }) => sql !== "COMMIT"));
  assert.equal(state.closed, 1);
});

test("staging stock check distinguishes an empty database from zero-stock existing items without writing", async () => {
  for (const stockRows of [[], [{ sku: product.sku, stock: 0 }], [{ sku: product.sku, stock: 3 }]]) {
    reset({ stockRows });
    process.argv = [process.execPath, "test", "--check-staging"];
    const result = await checkCoreInventoryPlan([product]);
    assert.equal(result.readOnly, true);
    assert.equal(result.organizationId, 7);
    assert.equal(result.missingProducts, 1 - stockRows.length);
    assert.equal(result.existingZeroStockWithCsvStock, Number(stockRows.length > 0 && stockRows[0].stock === 0));
    assert.equal(result.currentMatchedStockUnits, stockRows[0]?.stock || 0);
    assert.equal(state.calls[0].sql, "BEGIN READ ONLY");
    assert.ok(state.calls.every(({ sql }) => !/INSERT|UPDATE|DELETE|TRUNCATE|ALTER|CREATE/.test(sql)));
    const query = state.calls.find(({ sql }) => sql.startsWith("SELECT sku, stock"));
    assert.deepEqual(query.values, [7, [product.sku]]);
    assert.equal(state.closed, 1);
  }
});

test("stock check refuses production before opening a connection", async () => {
  reset();
  process.env.APP_ENV = "production";
  await assert.rejects(checkCoreInventoryPlan([product]), /must both be staging/);
  assert.equal(state.connections, 0);
});
