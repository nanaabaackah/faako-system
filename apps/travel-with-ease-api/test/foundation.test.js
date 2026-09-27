import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { MemoryLeadRepository } from "../src/crm/repository.js";
import { convertMinorUnits } from "../src/domain/money.js";
import { CurrencyService } from "../src/currency/service.js";
import { EstimatorService } from "../src/estimator/service.js";

class FixedProvider {
  constructor() { this.fail = false; }
  async getLatestRate() { if (this.fail) throw new Error("offline"); return { rate: "15.2500", provider: "test", providerTimestamp: "2026-09-27T10:00:00.000Z" }; }
  async getHistoricalRate() { return { rate: "14.0000" }; }
  async getLastUpdated() { return "2026-09-27T10:00:00.000Z"; }
}

const trip = { destination: "Istanbul", travellers: 2, nights: 7, travelDate: "2027-01-15", accommodation: "premium", tripStyle: "balanced", activities: "some", flightPreference: "economy" };
const configuration = { accommodation: { comfortable: ["90", "130"], premium: ["170", "260"], luxury: ["320", "520"] }, tripStyle: { relaxed: ["35", "60"], balanced: ["60", "100"], immersive: ["95", "160"] }, flightPreference: { economy: ["650", "1050"], premium_economy: ["1200", "1900"], business: ["2800", "4800"] }, activities: { few: "30", some: "75", many: "140" } };

test("precise conversion rounds integer minor units without floating-point arithmetic", () => {
  assert.equal(convertMinorUnits("120000", "15.2500"), 1830000n);
  assert.equal(convertMinorUnits("1", "1.5"), 2n);
});

test("currency service labels stale cached fallback", async () => {
  let now = new Date("2026-09-27T10:00:00.000Z");
  const provider = new FixedProvider();
  const service = new CurrencyService({ provider, ttlMs: 1000, now: () => now });
  assert.equal((await service.getLatestRate("USD", "GHS")).stale, false);
  now = new Date("2026-09-27T10:00:02.000Z"); provider.fail = true;
  const fallback = await service.getLatestRate("USD", "GHS");
  assert.equal(fallback.stale, true); assert.equal(fallback.cached, true);
});

test("public inquiry becomes a protected CRM lead", async (context) => {
  const repository = new MemoryLeadRepository();
  const provider = new FixedProvider();
  const estimatorService = new EstimatorService({ currencyService: new CurrencyService({ provider }), configuration });
  const app = createApp({ repository, estimatorService, agentToken: "development-token-that-is-long", environment: "test", logger: { error() {} } });
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening"); context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const created = await fetch(`${base}/api/public/inquiries`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...trip, name: "Ama Mensah", email: "ama@example.com", phone: "+233 24 000 0000", consent: true }) });
  assert.equal(created.status, 201);
  const denied = await fetch(`${base}/api/agent/leads`); assert.equal(denied.status, 401);
  const allowed = await fetch(`${base}/api/agent/leads`, { headers: { authorization: "Bearer development-token-that-is-long" } });
  assert.equal(allowed.status, 200);
  const payload = await allowed.json(); assert.equal(payload.data.items.length, 1); assert.equal(payload.data.items[0].stage, "new"); assert.equal(payload.data.items[0].inquiry.destination, "Istanbul");
});

test("honeypot submissions do not create leads", async (context) => {
  const repository = new MemoryLeadRepository();
  const estimatorService = new EstimatorService({ currencyService: new CurrencyService({ provider: new FixedProvider() }), configuration });
  const server = createApp({ repository, estimatorService, agentToken: "agent" }).listen(0, "127.0.0.1"); await once(server, "listening"); context.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/public/inquiries`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...trip, name: "Bot User", email: "bot@example.com", phone: "+233240000000", consent: true, website: "spam" }) });
  assert.equal(response.status, 202);
  assert.equal((await repository.listLeads()).length, 0);
});
