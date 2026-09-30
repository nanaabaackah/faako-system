import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after } from "node:test";

process.env.REEBS_SKIP_ENV_FILES = "true";
process.env.WATER_MOMO_WEBHOOK_SECRET = "water-webhook-handler-test-only";

let fixture;
const fixtureKey = "__reebsWaterWebhookHandlerTest";
globalThis[fixtureKey] = {
  createDatabaseClient: () => ({
    async connect() { fixture.connections += 1; },
    async end() { fixture.closed += 1; },
    async query(sql, values = []) {
      const statement = sql.replace(/\s+/g, " ").trim();
      fixture.queries.push({ statement, values });
      if (/^(?:CREATE TABLE|CREATE INDEX|ALTER TABLE|BEGIN|COMMIT|ROLLBACK)/.test(statement)) {
        return { rows: [], rowCount: 0 };
      }
      if (/^SELECT id FROM "waterSale"/.test(statement)) return { rows: [], rowCount: 0 };
      if (/^SELECT .* FROM "waterSale"/.test(statement)) {
        const scoped = values[0] === fixture.sale.id || values[0] === fixture.sale.paymentReference;
        const organizationMatches = values.length < 2 || values[1] === fixture.sale.organizationId;
        const active = !fixture.sale.archivedAt || !statement.includes('"archivedAt" IS NULL');
        return { rows: scoped && organizationMatches && active ? [{ ...fixture.sale }] : [], rowCount: Number(scoped && organizationMatches && active) };
      }
      if (/^INSERT INTO "waterMomoWebhookEvent"/.test(statement)) {
        if (fixture.fingerprints.has(values[0])) return { rows: [], rowCount: 0 };
        fixture.fingerprints.add(values[0]);
        return { rows: [{ id: 101 }], rowCount: 1 };
      }
      if (/^UPDATE "waterSale"/.test(statement)) {
        assert.match(statement, /WHERE id = \$1 AND "organizationId" = \$7 AND "archivedAt" IS NULL/,
          "a callback must never backfill unrelated or archived sales");
        assert.equal(values[0], fixture.sale.id);
        assert.equal(values[6], fixture.sale.organizationId);
        fixture.sale = { ...fixture.sale, paymentMethod: values[1], paymentStatus: values[2], paymentReference: values[3], providerReference: values[4], paidAt: values[5] };
        return { rows: [{ ...fixture.sale }], rowCount: 1 };
      }
      if (/^UPDATE "waterMomoWebhookEvent"/.test(statement)) return { rows: [], rowCount: 1 };
      throw new Error(`Unexpected fixture query: ${statement}`);
    },
  }),
};
const handlerUrl = new URL("./water-momo-webhook.js", import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === handlerUrl && specifier === "./_shared/databaseClient.js") {
      return { url: `data:text/javascript,export const createDatabaseClient = globalThis.${fixtureKey}.createDatabaseClient;`, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { handler } = await import(handlerUrl);
after(() => { hooks.deregister(); delete globalThis[fixtureKey]; });

const reset = (overrides = {}) => {
  fixture = {
    queries: [], fingerprints: new Set(), connections: 0, closed: 0,
    sale: { id: 42, organizationId: 7, paymentMethod: "momo", paymentStatus: "pending", paymentReference: "WATER-7-42", providerReference: null, totalAmount: 5400, paidAt: null, archivedAt: null, ...overrides },
  };
};
const event = (overrides = {}) => ({
  httpMethod: "POST", headers: { "content-type": "application/json", "x-water-webhook-secret": "water-webhook-handler-test-only" },
  body: JSON.stringify({ reference: "WATER-7-42", status: "success", amountCents: 5400, currency: "GHS", providerReference: "FIXTURE-PROVIDER-42", ...overrides }),
});
const saleUpdates = () => fixture.queries.filter(({ statement }) => /^UPDATE "waterSale"/.test(statement));

test("Water callback settles only its active sale, preserves tenant scope and never backfills history", async () => {
  reset();
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  assert.equal(fixture.sale.paymentStatus, "paid");
  assert.equal(saleUpdates().length, 1);
  assert.equal(fixture.queries.filter(({ statement }) => statement === "COMMIT").length, 1);
  assert.equal(fixture.closed, 1);
  assert.equal(fixture.queries.some(({ statement }) => /"(?:order|payment|journalEntry)"/.test(statement)), false);
});

test("Water callback exact replay does not update the sale or paid date a second time", async () => {
  reset();
  await handler(event());
  const paidAt = fixture.sale.paidAt;
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).idempotentReplay, true);
  assert.equal(saleUpdates().length, 1);
  assert.equal(fixture.sale.paidAt, paidAt);
});

for (const reference of ["WATER-7-42", "legacy-water-fixture"]) {
  test(`Water callback cannot settle an archived sale through ${reference.startsWith("WATER") ? "sale id" : "reference"} lookup`, async () => {
    reset({ archivedAt: "2026-09-25T00:00:00Z", paymentReference: reference });
    const response = await handler(event({ reference }));
    assert.equal(response.statusCode, 404);
    assert.equal(saleUpdates().length, 0);
    assert.equal(fixture.queries.at(-1).statement, "ROLLBACK");
  });
}

for (const [name, payload] of [
  ["wrong amount", { amountCents: 1 }], ["missing amount", { amountCents: undefined }],
  ["wrong currency", { currency: "USD" }],
]) {
  test(`Water callback rejects ${name} without changing payment facts`, async () => {
    reset();
    const response = await handler(event(payload));
    assert.equal(response.statusCode, 409);
    assert.equal(saleUpdates().length, 0);
    assert.equal(fixture.queries.at(-1).statement, "ROLLBACK");
  });
}

test("Water callback cannot use another organization's canonical reference to reach the sale", async () => {
  reset();
  const response = await handler(event({ reference: "WATER-8-42" }));
  assert.equal(response.statusCode, 404);
  assert.equal(saleUpdates().length, 0);
});
