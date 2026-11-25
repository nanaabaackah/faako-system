import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createPortalApp, isAllowedPortalApiRoute, readPortalUpstream } from "../src/portal/proxy.js";

test("portal upstream allows only fixed HTTPS origins outside local tests", () => {
  assert.equal(readPortalUpstream("https://api.example.test", "staging"), "https://api.example.test");
  for (const url of ["http://api.example.test", "https://api.example.test/", "https://user:pass@api.example.test", "https://api.example.test/path", "https://api.example.test?url=other"]) {
    assert.throws(() => readPortalUpstream(url, "production"));
  }
  assert.equal(readPortalUpstream("http://127.0.0.1:3090", "test"), "http://127.0.0.1:3090");
  const handoverId = "10000000-0000-4000-8000-000000000003";
  assert.equal(isAllowedPortalApiRoute("GET", "/api/agent/administration/handover"), true);
  assert.equal(isAllowedPortalApiRoute("POST", "/api/agent/administration/handover"), true);
  assert.equal(isAllowedPortalApiRoute("POST", `/api/agent/administration/handover/${handoverId}/approve`), true);
  assert.equal(isAllowedPortalApiRoute("GET", `/api/agent/administration/handover/${handoverId}/approve`), false);
  const publicationId = "134c845f-49e7-4566-8752-a23a3ad0185c";
  assert.equal(isAllowedPortalApiRoute("POST", `/api/agent/content/publication-jobs/${publicationId}/cancel`), true);
  assert.equal(isAllowedPortalApiRoute("POST", `/api/agent/content/publication-jobs/${publicationId}/retry`), true);
  assert.equal(isAllowedPortalApiRoute("GET", `/api/agent/content/publication-jobs/${publicationId}/cancel`), false);
  assert.equal(isAllowedPortalApiRoute("POST", "/api/agent/content/publication-jobs/bad/cancel"), false);
  assert.equal(isAllowedPortalApiRoute("POST", `/api/agent/content/publication-jobs/${publicationId}/delete`), false);
  const mediaId = "234c845f-49e7-4566-8752-a23a3ad0185c";
  assert.equal(isAllowedPortalApiRoute("GET", "/api/agent/media/drive"), true);
  assert.equal(isAllowedPortalApiRoute("POST", "/api/agent/media/drive/import"), true);
  assert.equal(isAllowedPortalApiRoute("POST", "/api/agent/media/upload"), true);
  assert.equal(isAllowedPortalApiRoute("POST", `/api/agent/media/${mediaId}/replace`), true);
  assert.equal(isAllowedPortalApiRoute("GET", "/api/agent/media/drive/import"), false);
  assert.equal(isAllowedPortalApiRoute("POST", "/api/agent/media/drive/delete"), false);
});

test("portal verifies Access, restricts proxy routes and preserves only scoped credentials", async () => {
  const calls = [];
  let upstreamStatus = 200;
  let upstreamFailure = false;
  const settings = { portalOrigin: "https://portal.example.test", secure: true };
  const app = createPortalApp({ settings, upstream: "https://api.example.test",
    distDirectory: fileURLToPath(new URL("../config/", import.meta.url)),
    verifier: { async verify(value) { if (value !== "synthetic-valid") throw new Error("denied"); } },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (upstreamFailure) throw new Error("Do not expose this upstream detail");
      return new Response(JSON.stringify({ ok: true }), { status: upstreamStatus, headers: {
        "Content-Type": "application/json", "Set-Cookie": "__Host-twe_session=fixture; Path=/; Secure; HttpOnly; SameSite=Lax",
        "Cache-Control": "public, max-age=9999", Location: "https://other.example.test", "X-Untrusted": "omit",
      } });
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const request = (path, { method = "GET", headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: server.address().port, path, method,
      headers: { host: "portal.example.test", "cf-access-jwt-assertion": "synthetic-valid", ...headers } }, res => {
      const chunks = []; res.on("data", data => chunks.push(data));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject); req.end(body);
  });
  try {
    assert.equal((await request("/healthz", { headers: { "cf-access-jwt-assertion": "invalid" } })).status, 200);
    assert.equal((await request("/currencies.json", { headers: { "cf-access-jwt-assertion": "invalid" } })).status, 401);
    assert.equal((await request("/currencies.json")).status, 200);
    assert.equal((await request("/api/auth/session", { headers: { "cf-access-jwt-assertion": ["synthetic-valid", "synthetic-valid"] } })).status, 401);
    assert.equal((await request("/api/auth/session", { headers: { host: "alternate.example.test" } })).status, 403);
    for (const path of ["/api/public/inquiries", "/api/agent/../auth/session", "/api/agent/%2e%2e/auth/session", "/api/auth/session/", "/api/auth/login", "/api/auth/session?url=\\other"]) {
      assert.ok([400, 404].includes((await request(path)).status));
    }
    assert.equal((await request("/api/auth/access-session", { method: "POST" })).status, 403);
    assert.equal((await request("/api/agent/leads", { method: "DELETE" })).status, 404);
    assert.equal(calls.length, 0);
    const response = await request("/api/auth/access-session", { method: "POST", body: "{}", headers: {
      origin: settings.portalOrigin, "content-type": "application/json", "x-csrf-token": "fixture-csrf", "x-twe-session-init": "1",
      "x-request-id": "fixture-request-123", cookie: "CF_Authorization=secret; __Host-twe_session=fixture; other=secret",
      authorization: "Bearer omit", "x-forwarded-for": "1.2.3.4", "cf-access-authenticated-user-email": "untrusted@example.test",
    } });
    assert.equal(response.status, 200);
    assert.equal(response.headers["cache-control"], "private, no-store");
    assert.equal(response.headers["x-request-id"], "fixture-request-123");
    assert.equal(response.headers["x-untrusted"], undefined);
    assert.match(response.headers["set-cookie"][0], /Secure; HttpOnly; SameSite=Lax/);
    assert.equal(calls[0].url, "https://api.example.test/api/auth/access-session");
    assert.equal(calls[0].options.headers.cookie, "__Host-twe_session=fixture");
    assert.equal(calls[0].options.headers["x-csrf-token"], "fixture-csrf");
    assert.equal(calls[0].options.headers.authorization, undefined);
    assert.equal(calls[0].options.headers["x-forwarded-for"], undefined);
    assert.equal(calls[0].options.redirect, "manual");
    const publicationId = "134c845f-49e7-4566-8752-a23a3ad0185c";
    const cancelPath = `/api/agent/content/publication-jobs/${publicationId}/cancel`;
    const cancel = await request(cancelPath, { method: "POST", body: "{}", headers: {
      origin: settings.portalOrigin, "content-type": "application/json", "x-csrf-token": "fixture-csrf",
      cookie: "__Host-twe_session=fixture",
    } });
    assert.equal(cancel.status, 200);
    assert.equal(calls[1].url, `https://api.example.test${cancelPath}`);
    assert.equal(calls[1].options.method, "POST");
    assert.equal(calls[1].options.headers["x-csrf-token"], "fixture-csrf");
    assert.equal(calls[1].options.headers.cookie, "__Host-twe_session=fixture");
    assert.equal((await request(cancelPath, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const upload = await request("/api/agent/media/upload", { method: "POST", body: image, headers: {
      origin: settings.portalOrigin, "content-type": "image/png", "content-length": String(image.length),
      "x-csrf-token": "fixture-csrf", "x-media-alt": "Beach%20at%20sunset", cookie: "__Host-twe_session=fixture",
    } });
    assert.equal(upload.status, 200);
    assert.equal(calls[2].url, "https://api.example.test/api/agent/media/upload");
    assert.equal(calls[2].options.headers["content-type"], "image/png");
    assert.equal(calls[2].options.headers["x-media-alt"], "Beach%20at%20sunset");
    assert.deepEqual(calls[2].options.body, image);
    assert.equal((await request("/api/auth/session", { headers: { cookie: "__Host-twe_session=a; __Host-twe_session=b" } })).status, 400);
    assert.equal((await request("/api/auth/access-session", { method: "POST", headers: { origin: settings.portalOrigin, "content-type": "application/json" }, body: "x".repeat(32769) })).status, 413);
    assert.equal(calls.length, 3);
    upstreamStatus = 302;
    const redirect = await request("/api/auth/session");
    assert.equal(redirect.status, 502);
    assert.equal(redirect.headers.location, undefined);
    assert.equal(calls.length, 4);
    upstreamFailure = true;
    const unavailable = await request("/api/auth/session");
    assert.equal(unavailable.status, 502);
    assert.doesNotMatch(unavailable.body, /upstream detail/);
    assert.equal(unavailable.headers["cache-control"], "private, no-store");
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test("hosted CMS guard permits exact template and form operations without widening API access", () => {
  for (const slug of ["enquiry-acknowledgement", "staff-invitation"]) {
    const base = "/api/agent/templates/" + slug;
    for (const path of [base, base + "/history"]) assert.equal(isAllowedPortalApiRoute("GET", path), true);
    for (const action of ["draft", "preview", "activate", "test", "restore"]) {
      assert.equal(isAllowedPortalApiRoute("POST", base + "/" + action), true);
      assert.equal(isAllowedPortalApiRoute("GET", base + "/" + action), false);
    }
  }
  for (const slug of ["intake", "detailed"]) {
    const base = "/api/agent/enquiry-forms/" + slug;
    for (const path of [base, base + "/history"]) assert.equal(isAllowedPortalApiRoute("GET", path), true);
    for (const action of ["draft", "activate", "restore"]) {
      assert.equal(isAllowedPortalApiRoute("POST", base + "/" + action), true);
      assert.equal(isAllowedPortalApiRoute("GET", base + "/" + action), false);
    }
  }
  for (const path of ["/api/agent/templates/unknown", "/api/agent/templates/enquiry-acknowledgement/delete", "/api/agent/enquiry-forms/unknown", "/api/agent/enquiry-forms/intake/delete", "/api/agent/enquiry-forms/intake/../detailed", "/api/agent/enquiry-forms/%69ntake", "/api/public/enquiry-forms/intake"]) {
    assert.equal(isAllowedPortalApiRoute("GET", path), false);
    assert.equal(isAllowedPortalApiRoute("POST", path), false);
  }
});
