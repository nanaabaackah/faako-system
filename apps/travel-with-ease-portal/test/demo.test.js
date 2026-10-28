import test from "node:test";
import assert from "node:assert/strict";
import { createDemoClient, demoEnabled } from "../src/demo.js";

test("demo requires development permission, loopback host and explicit opt-in", () => {
  assert.equal(demoEnabled({ allowed: true, hostname: "localhost", search: "?demo=1" }), true);
  for (const hostname of ["portal-staging.travelwitheasegh.com", "192.168.1.2", "localhost.attacker.invalid"]) {
    assert.equal(demoEnabled({ allowed: true, hostname, search: "?demo=1" }), false);
  }
  assert.equal(demoEnabled({ allowed: false, hostname: "localhost", search: "?demo=1" }), false);
  assert.equal(demoEnabled({ allowed: true, hostname: "localhost", search: "" }), false);
});

test("demo mutations stay in memory and unsupported actions cannot report success", async () => {
  const api = createDemoClient();
  const list = await api.get("/api/agent/inquiries");
  const item = list.items[0];
  await api.post(`/api/agent/inquiries/${item.id}/status`, { json: { status: "closed", expectedVersion: 1 } });
  assert.equal((await api.get(`/api/agent/inquiries/${item.id}`)).status, "closed");
  assert.equal((await createDemoClient().get(`/api/agent/inquiries/${item.id}`)).status, "new");
  const page = await api.get("/api/agent/content/home");
  await api.post("/api/agent/content/home/draft", { json: { expectedVersion: 1, body: { ...page.body, heading: "Changed fixture" } } });
  assert.equal((await api.get("/api/agent/content/home")).body.heading, "Changed fixture");
  for (const path of ["/api/agent/content/home/publish", "/api/agent/media/upload", "/api/agent/administration/staff"]) {
    await assert.rejects(api.post(path), /No action was performed/);
  }
  await api.post("/api/auth/logout");
  await assert.rejects(api.get("/api/auth/session"), { status: 401 });
});
