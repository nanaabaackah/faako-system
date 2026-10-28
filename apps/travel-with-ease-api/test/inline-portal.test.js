import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createInlinePortal } from "../src/portal/inline.js";

test("embedded CMS is host-scoped, Access-protected, and uses same-process API routing", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "twe-inline-cms-"));
  await writeFile(path.join(directory, "index.html"), "<!doctype html><title>Private TWE CMS</title>");
  await writeFile(path.join(directory, "main.js"), "window.cms = true;");
  const settings = { portalOrigin: "https://cms.example.test", secure: true };
  const { guard, serve } = createInlinePortal({
    settings,
    verifier: { async verify(assertion) {
      if (assertion !== "synthetic-valid") throw new Error("Invalid synthetic assertion");
    } },
    distDirectory: directory,
  });
  const app = express();
  app.use((req, _res, next) => { req.requestId = "synthetic-request"; next(); });
  app.use(guard);
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.get("/readyz", (_req, res) => res.json({ ready: true }));
  app.get("/api/auth/status", (_req, res) => res.json({ data: { configured: true, mode: "cloudflare_access" } }));
  app.get("/api/auth/session", (_req, res) => res.status(401).json({ error: "No session" }));
  app.post("/api/auth/access-session", (_req, res) => res.status(201).json({ data: { signedIn: true } }));
  app.post("/api/public/inquiries", (_req, res) => res.status(202).end());
  app.use(serve);
  app.use((_req, res) => res.status(404).end());

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const request = (url, { host = "cms.example.test", method = "GET", assertion, headers = {}, body } = {}) =>
    new Promise((resolve, reject) => {
      const req = http.request({
        host: "127.0.0.1", port: server.address().port, path: url, method,
        headers: { host, ...(assertion ? { "cf-access-jwt-assertion": assertion } : {}), ...headers },
      }, res => {
        const chunks = [];
        res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => resolve({
          status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8"),
        }));
      });
      req.on("error", reject);
      req.end(body);
    });

  try {
    assert.equal((await request("/healthz")).status, 200);
    assert.equal((await request("/readyz")).status, 401);
    assert.equal((await request("/")).status, 401);
    assert.equal((await request("/main.js")).status, 401);
    assert.equal((await request("/api/auth/status")).status, 401);
    assert.equal((await request("/api/auth/status", { assertion: "invalid" })).status, 401);
    assert.equal((await request("/api/auth/status", { assertion: ["synthetic-valid", "synthetic-valid"] })).status, 401);

    const status = await request("/api/auth/status", { assertion: "synthetic-valid" });
    assert.equal(status.status, 200);
    assert.equal(status.headers.location, undefined);
    assert.equal(JSON.parse(status.body).data.mode, "cloudflare_access");
    assert.equal(status.headers["cache-control"], "private, no-store");
    assert.equal(status.headers["x-robots-tag"], "noindex, nofollow");
    assert.match(status.headers["content-security-policy"], /connect-src 'self'/);

    const home = await request("/", { assertion: "synthetic-valid" });
    assert.equal(home.status, 200);
    assert.match(home.body, /Private TWE CMS/);
    assert.equal((await request("/main.js", { assertion: "synthetic-valid" })).status, 200);
    assert.equal((await request("/api/auth/session", { assertion: "synthetic-valid" })).status, 401);
    assert.equal((await request("/api/auth/login", { assertion: "synthetic-valid" })).status, 404);
    assert.equal((await request("/api/public/inquiries", { assertion: "synthetic-valid", method: "POST", headers: { origin: settings.portalOrigin } })).status, 404);
    assert.equal((await request("/api/agent/../auth/session", { assertion: "synthetic-valid" })).status, 404);
    assert.equal((await request("/api/auth/access-session", { assertion: "synthetic-valid", method: "POST" })).status, 403);
    assert.equal((await request("/api/auth/access-session", { assertion: "synthetic-valid", method: "POST", headers: { origin: settings.portalOrigin } })).status, 201);
    assert.equal((await request("/api/auth/status", { assertion: "synthetic-valid", host: "api.example.test" })).status, 200);
    assert.equal((await request("/index.html", { assertion: "synthetic-valid", host: "api.example.test" })).status, 404);
    assert.equal((await request("/api/public/inquiries", { method: "POST", host: "api.example.test" })).status, 202);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
