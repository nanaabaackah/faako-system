import test from "node:test";
import assert from "node:assert/strict";
import { createDemoClient, demoEnabled } from "../src/demo.js";

test("Drive demo imports once into an in-memory library and never connects to Google/R2", async () => {
  const api = createDemoClient();
  const folder = await api.get("/api/agent/media/drive");
  assert.equal(folder.items.length, 1);
  const input = { fileId: folder.items[0].id, version: "1", alt: "Synthetic photo", rights: "Generated demo fixture" };
  const first = await api.post("/api/agent/media/drive/import", { json: input });
  assert.equal(first.demo, true);
  assert.equal(first.unchanged, false);
  const repeat = await api.post("/api/agent/media/drive/import", { json: input });
  assert.equal(repeat.id, first.id);
  assert.equal(repeat.unchanged, true);
  assert.equal((await api.get("/api/agent/media")).items.length, 1);
  assert.equal((await createDemoClient().get("/api/agent/media")).items.length, 0);
});

test("demo requires development permission, loopback host and explicit opt-in", () => {
  assert.equal(demoEnabled({ allowed: true, hostname: "localhost", search: "?demo=1" }), true);
  for (const hostname of ["portal-staging.travelwitheasegh.com", "192.168.1.2", "localhost.attacker.invalid"]) {
    assert.equal(demoEnabled({ allowed: true, hostname, search: "?demo=1" }), false);
  }
  assert.equal(demoEnabled({ allowed: false, hostname: "localhost", search: "?demo=1" }), false);
  assert.equal(demoEnabled({ allowed: true, hostname: "localhost", search: "" }), false);
});

test("staging portal demo accepts only the approved route, hostname, and explicit build permission", () => {
  const origin = { hostname: "portal-staging.travelwitheasegh.com", pathname: "/demo" };
  assert.equal(demoEnabled({ ...origin, stagingAllowed: true }), true);
  assert.equal(demoEnabled({ ...origin, pathname: "/demo/", stagingAllowed: true }), true);
  for (const options of [
    { ...origin, stagingAllowed: false },
    { ...origin, hostname: "portal.travelwitheasegh.com", stagingAllowed: true },
    { ...origin, hostname: "staging-api.travelwitheasegh.com", stagingAllowed: true },
    { ...origin, hostname: "portal-staging.travelwitheasegh.com.attacker.test", stagingAllowed: true },
    { ...origin, pathname: "/", stagingAllowed: true, search: "?demo=1" },
    { ...origin, pathname: "/admin/demo", stagingAllowed: true },
    { ...origin, pathname: "/demo/access-session", stagingAllowed: true },
  ]) assert.equal(demoEnabled(options), false);
  // Hosted demo permission must not enable the local query-string route.
  assert.equal(demoEnabled({ allowed: false, stagingAllowed: true,
    hostname: "localhost", pathname: "/", search: "?demo=1" }), false);
});

test("demo mutations stay in memory and unsupported actions cannot report success", async () => {
  const api = createDemoClient();
  const list = await api.get("/api/agent/inquiries");
  const item = list.items[0];
  await api.post(`/api/agent/inquiries/${item.id}/status`, { json: { status: "closed", expectedVersion: 1 } });
  assert.equal((await api.get(`/api/agent/inquiries/${item.id}`)).status, "closed");
  assert.equal((await createDemoClient().get(`/api/agent/inquiries/${item.id}`)).status, "new");
  const page = await api.get("/api/agent/content/home");
  for (const slug of ["journal", "travel-footprint", "how-it-works", "privacy", "terms", "cookies"]) {
    const draft = await api.get(`/api/agent/content/${slug}`);
    await api.post(`/api/agent/content/${slug}/draft`, { json: { expectedVersion: draft.version, body: { ...draft.body, heading: "Changed synthetic section" } } });
    assert.equal((await api.get(`/api/agent/content/${slug}`)).body.heading, "Changed synthetic section");
    assert.notEqual((await createDemoClient().get(`/api/agent/content/${slug}`)).body.heading, "Changed synthetic section");
  }
  await api.post("/api/agent/content/home/draft", { json: { expectedVersion: 1, body: { ...page.body, heading: "Changed fixture" } } });
  assert.equal((await api.get("/api/agent/content/home")).body.heading, "Changed fixture");
  for (const path of ["/api/agent/content/home/publish", "/api/agent/media/upload", "/api/agent/administration/staff"]) {
    await assert.rejects(api.post(path), /No action was performed/);
  }
  await api.post("/api/auth/logout");
  await assert.rejects(api.get("/api/auth/session"), { status: 401 });
});
