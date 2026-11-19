import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const environment = {
  TTNGH_ALLOWED_ORIGINS: "https://thethrivingnetworkgh.org",
  TTNGH_CONTACT_ENABLED: "true",
  TURNSTILE_SECRET_KEY: "synthetic",
  TURNSTILE_HOSTNAMES: "thethrivingnetworkgh.org",
  RESEND_API_KEY: "synthetic",
  TTNGH_MAIL_FROM: "sender@example.org",
  TTNGH_ENQUIRY_TO: "team@example.org",
};

test("TTNGH uses only existing Railway DATABASE_URL", () => {
  const config = loadConfig({ ...environment, DATABASE_URL: "postgresql://localhost/ttngh" });
  assert.equal(config.databaseUrl, "postgresql://localhost/ttngh");
  assert.equal(config.enabled, true);
  // A missing connection must not crash the server before /health can respond.
  assert.equal(loadConfig(environment).databaseUrl, "");
});

test("health stays live when private enquiry tables are not ready", async t => {
  const config = loadConfig({ ...environment, DATABASE_URL: "postgresql://localhost/ttngh" });
  let ready = false;
  let verificationCalled = false;
  const app = createApp(config, {
    enquiryStore: { async create() { throw new Error("must not be called"); } },
    contactReady: () => ready,
    request: () => { verificationCalled = true; throw new Error("must not contact provider"); },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  let response = await fetch(url + "/health");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { status: "ok", enquiries: "unavailable" });
  response = await fetch(url + "/api/enquiries", {
    method: "POST",
    headers: { Origin: "https://thethrivingnetworkgh.org", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Visitor", email: "visitor@example.org", topic: "Events",
      message: "I would like more information about TTNGH events.", consent: true,
      website: "", turnstileToken: "synthetic-token",
      submissionId: "aa837d8f-9826-4a85-bb0e-9ee115847c02",
    }),
  });
  assert.equal(response.status, 503);
  assert.equal(verificationCalled, false);
  ready = true;
  response = await fetch(url + "/health");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { status: "ok", enquiries: "ready" });
});
