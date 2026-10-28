import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import express from "express";
import { enquiriesRoutes } from "../src/enquiries/routes.js";
import { ROLE_PERMISSIONS } from "../src/auth/permissions.js";

const organisation = "10000000-0000-4000-8000-000000000001";
const enquiry = "10000000-0000-4000-8000-000000000002";
const actor = "10000000-0000-4000-8000-000000000003";
const sample = { id: enquiry, kind: "personalised", status: "new",
  contact: { name: "Synthetic traveller" }, details: { destination: "Synthetic place" },
  created_at: new Date("2026-10-27T00:00:00Z"), updated_at: new Date("2026-10-27T00:00:00Z"), version: "10" };

test("owner/editor may update enquiries; platform admin has no business write permission", () => {
  assert.ok(ROLE_PERMISSIONS.owner.includes("enquiries.write"));
  assert.ok(ROLE_PERMISSIONS.editor.includes("enquiries.write"));
  assert.equal(ROLE_PERMISSIONS.platform_admin.includes("enquiries.write"), false);
});

test("enquiry inbox uses scoped queries, CSRF, version matching and an atomic audit", async () => {
  const queries = [];
  let revision = "10";
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (/^BEGIN|^COMMIT|^ROLLBACK/.test(sql)) return { rows: [] };
      if (sql.includes("UPDATE twe.enquiries")) return { rows: values[3] === revision
        ? [{ ...sample, status: values[2], version: String(Number(revision) + 1) }] : [] };
      if (sql.includes("INSERT INTO twe.audit_records")) return { rows: [] };
      throw new Error("Unexpected transaction query");
    },
    release() {},
  };
  const pool = {
    async connect() { return client; },
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes("FROM twe.enquiries") && sql.includes("LIMIT 26")) return { rows: [sample] };
      if (sql.includes("FROM twe.enquiries") && sql.includes("xmin::text")) return { rows: [sample] };
      throw new Error("Unexpected read query");
    },
  };
  const auth = {
    requirePermission: permission => (req, res, next) =>
      permission === "enquiries.write" && req.headers["x-role"] !== "owner"
        ? res.sendStatus(403) : next(),
    requireMutation: (req, res, next) =>
      req.headers["x-csrf-token"] === "synthetic-csrf" ? next() : res.sendStatus(403),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = "synthetic-request";
    req.staff = { id: actor, role: req.headers["x-role"] || "owner", organisationId: organisation };
    next();
  });
  app.use("/api/agent/inquiries", enquiriesRoutes({ pool, organisationId: organisation, auth }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const request = (url, { method = "GET", role = "owner", csrf, json } = {}) =>
    new Promise((resolve, reject) => {
      const payload = json ? JSON.stringify(json) : null;
      const req = http.request({ host: "127.0.0.1", port: server.address().port, path: url, method,
        headers: { "x-role": role, ...(csrf ? { "x-csrf-token": csrf } : {}),
          ...(payload ? { "content-type": "application/json" } : {}) } }, res => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString() }));
      });
      req.on("error", reject);
      req.end(payload);
    });
  try {
    assert.equal((await request("/api/agent/inquiries?status=bogus")).status, 400);
    assert.equal((await request("/api/agent/inquiries?offset=-1")).status, 400);
    const list = await request("/api/agent/inquiries?status=new&kind=personalised&offset=0");
    assert.equal(list.status, 200);
    assert.match(list.text, /Synthetic traveller/);
    assert.doesNotMatch(list.text, /Synthetic place/); // Details only in single-record view.
    const detailed = await request(`/api/agent/inquiries/${enquiry}`);
    assert.equal(detailed.status, 200);
    assert.match(detailed.text, /Synthetic place/);
    assert.equal((await request(`/api/agent/inquiries/${enquiry}/status`, { method: "POST",
      json: { status: "contacted", expectedVersion: 10 } })).status, 403);
    assert.equal((await request(`/api/agent/inquiries/${enquiry}/status`, { method: "POST",
      role: "platform_admin", csrf: "synthetic-csrf",
      json: { status: "contacted", expectedVersion: 10 } })).status, 403);
    assert.equal((await request(`/api/agent/inquiries/${enquiry}/status`, { method: "POST",
      csrf: "synthetic-csrf", json: { status: "contacted", expectedVersion: 9 } })).status, 409);
    const updated = await request(`/api/agent/inquiries/${enquiry}/status`, { method: "POST",
      csrf: "synthetic-csrf", json: { status: "contacted", expectedVersion: 10 } });
    assert.equal(updated.status, 200);
    assert.equal(JSON.parse(updated.text).data.status, "contacted");
    assert.equal(queries.filter(item => item.sql.includes("INSERT INTO twe.audit_records")).length, 1);
    assert.ok(queries.some(item => item.sql.includes("organisation_id = $1") && item.values[0] === organisation));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
