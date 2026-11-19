import test from "node:test";
import assert from "node:assert/strict";
import { createEnquiryReadiness } from "../src/contact/readiness.js";

const logger = { info() {}, warn() {} };

test("missing pool leaves enquiry storage unavailable without throwing", async () => {
  const state = createEnquiryReadiness(null, logger);
  assert.equal(state.isReady(), false);
  assert.equal(await state.refresh(), false);
  assert.equal(state.isReady(), false);
});

test("both enquiry tables must exist for contact readiness", async () => {
  let available = false;
  const queries = [];
  const pool = { async query(sql) {
    queries.push(sql);
    if (!available && sql.includes("notification_outbox")) throw Object.assign(new Error("missing"), { code: "42P01" });
    return { rows: [], rowCount: 0 };
  }};
  const state = createEnquiryReadiness(pool, logger);
  assert.equal(await state.refresh(), false);
  assert.equal(state.isReady(), false);
  available = true;
  assert.equal(await state.refresh(), true);
  assert.equal(state.isReady(), true);
  assert.ok(queries.some(x => x.includes("ttngh_contact.enquiries")));
  assert.ok(queries.some(x => x.includes("ttngh_contact.notification_outbox")));
});

test("temporary loss of connectivity makes contacts unavailable until recovery", async () => {
  let healthy = true;
  const pool = { async query() {
    if (!healthy) throw Object.assign(new Error("secret connection details"), { code: "ECONNREFUSED" });
    return { rows: [] };
  }};
  const state = createEnquiryReadiness(pool, logger);
  assert.equal(await state.refresh(), true);
  healthy = false;
  assert.equal(await state.refresh(), false);
  assert.equal(state.isReady(), false);
  healthy = true;
  assert.equal(await state.refresh(), true);
});
