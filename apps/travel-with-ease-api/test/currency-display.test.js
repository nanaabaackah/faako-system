import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { currencyDisplayRoutes } from "../src/currency/display-routes.js";
import { ExchangeRateApiProvider } from "../src/currency/provider.js";
import { createApp } from "../src/app.js";
import { MemoryLeadRepository } from "../src/crm/repository.js";

async function fixture(context, service) {
  const app = express();
  app.use((req, _res, next) => { req.requestId = "currency-test"; next(); });
  app.use("/", currencyDisplayRoutes(service));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}
const service = result => ({
  getSupportedCurrencies: () => ["GHS", "USD", "GBP"],
  getLatestRate: async (base, quote) => {
    assert.equal(base, "GHS");
    assert.ok(["USD", "GBP"].includes(quote));
    return { rate: "0.08", providerTimestamp: new Date().toISOString(), stale: false, ...result };
  },
});

test("public display rates use GHS, a strict currency allowlist and a minimal non-sensitive envelope", async context => {
  const origin = await fixture(context, service({ privateKey: "must-not-leak" }));
  const response = await fetch(origin + "/?currency=USD");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /max-age=300/);
  const payload = await response.json();
  assert.equal(payload.data.baseCurrency, "GHS");
  assert.equal(payload.data.currency, "USD");
  assert.equal(payload.data.indicative, true);
  assert.equal(payload.meta.requestId, "currency-test");
  assert.doesNotMatch(JSON.stringify(payload), /must-not-leak|privateKey/);
  for (const query of ["", "currency=XXX", "currency=usd", "currency=USD&currency=GBP", "currency=USD&amount=100", "currency=https://example.com"]) {
    assert.equal((await fetch(origin + "/?" + query)).status, 400);
  }
});

test("invalid, expired or unavailable rates fail closed with no provider secrets", async context => {
  for (const result of [
    { rate: "0" }, { rate: "-1" }, { rate: "NaN" },
    { providerTimestamp: "invalid" },
    { providerTimestamp: new Date(Date.now() - 73 * 3_600_000).toISOString() },
    { providerTimestamp: new Date(Date.now() + 3_600_000).toISOString() },
  ]) {
    const origin = await fixture(context, service(result));
    const response = await fetch(origin + "/?currency=USD");
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "service_unavailable");
  }
  const origin = await fixture(context, undefined);
  assert.equal((await fetch(origin + "/?currency=USD")).status, 503);
});

test("bounded cached fallback is labelled stale and failed lookups have a cooldown", async context => {
  const staleOrigin = await fixture(context, service({ providerTimestamp: new Date(Date.now() - 40 * 3_600_000).toISOString() }));
  assert.equal((await (await fetch(staleOrigin + "/?currency=USD")).json()).data.stale, true);
  let calls = 0;
  const origin = await fixture(context, {
    getSupportedCurrencies: () => ["USD"],
    getLatestRate: async () => { calls++; throw new Error("private-provider-url-and-token"); },
  });
  for (let i = 0; i < 2; i++) {
    const response = await fetch(origin + "/?currency=USD");
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private-provider/);
  }
  assert.equal(calls, 1);
});

test("provider uses documented open/keyed endpoints and validates source currency and timestamp", async () => {
  for (const keyed of [false, true]) {
    const provider = new ExchangeRateApiProvider({
      apiKey: keyed ? "synthetic-test-key" : "", retries: 0,
      fetchImpl: async url => {
        assert.equal(url, keyed ? "https://v6.exchangerate-api.com/v6/synthetic-test-key/latest/GHS" : "https://open.er-api.com/v6/latest/GHS");
        return { ok: true, json: async () => ({ result: "success", base_code: "GHS", time_last_update_utc: new Date().toISOString(), [keyed ? "conversion_rates" : "rates"]: { USD: 0.08 } }) };
      },
    });
    assert.equal((await provider.getLatestRate("GHS", "USD")).rate, "0.08");
  }
  const provider = new ExchangeRateApiProvider({ retries: 0, fetchImpl: async () => ({ ok: true, json: async () => ({ result: "success", base_code: "USD", rates: { USD: 1 } }) }) });
  await assert.rejects(provider.getLatestRate("GHS", "USD"), /response is invalid/);
});

test("the actual public currency route is read-only and has its own bounded request quota", async context => {
  const repository = new MemoryLeadRepository();
  const app = createApp({ repository, currencyService: service(), environment: "test" });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(origin + "/api/public/currency", { method: "POST" })).status, 404);
  for (let i = 0; i < 59; i++) assert.equal((await fetch(origin + "/api/public/currency?currency=USD")).status, 200);
  const limited = await fetch(origin + "/api/public/currency?currency=USD");
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
  assert.equal((await repository.listLeads()).length, 0);
});
