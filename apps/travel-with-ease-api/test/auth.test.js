import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp, createLimiter } from "../src/app.js";
import { createStaffAuth } from "../src/auth/routes.js";
import { readAuthConfig } from "../src/auth/config.js";

test("OIDC is disabled without configuration and partial/insecure configuration fails closed", () => {
  assert.equal(readAuthConfig({}), null);
  assert.throws(() => readAuthConfig({ TWE_OIDC_ISSUER: "https://id.example.invalid" }));
  const config = { TWE_OIDC_ISSUER: "https://id.example.invalid", TWE_OIDC_CLIENT_ID: "synthetic", TWE_OIDC_CLIENT_SECRET: "synthetic-only", TWE_OIDC_MFA_ACR: "test-mfa", TWE_API_ORIGIN: "http://localhost:3090", TWE_PORTAL_ORIGIN: "http://localhost:5188" };
  assert.equal(readAuthConfig(config).secure, false);
  assert.equal(readAuthConfig({ ...config, TWE_OIDC_RECOVERY_URL: "https://id.example.invalid/recover" }).recoveryUrl, "https://id.example.invalid/recover");
  assert.throws(() => readAuthConfig({ ...config, TWE_OIDC_REGISTRATION_URL: "javascript:alert(1)" }));
  assert.throws(() => readAuthConfig({ ...config, TWE_OIDC_RECOVERY_URL: "https://secret@id.example.invalid/recover" }));
  assert.throws(() => readAuthConfig({ ...config, APP_ENV: "staging" }));
  assert.throws(() => readAuthConfig({ ...config, TWE_OIDC_ISSUER: "http://id.example.invalid" }));
  assert.throws(() => readAuthConfig({ ...config, TWE_PORTAL_ORIGIN: "https://portal.example.invalid/path" }));
});

test("server sessions protect routes, reject replay/CSRF, enforce roles and revoke on logout", async (context) => {
  const flows = new Map();
  const sessions = new Map();
  let role = "editor";
  let deniedIdentity = false;
  const store = {
    organisationId: "synthetic-org",
    async saveFlow(hash, flow) { flows.set(hash, flow); },
    async consumeFlow(hash) { const flow = flows.get(hash); flows.delete(hash); return flow; },
    async createSession(_identity, hash, csrfHash) {
      if (deniedIdentity) return null;
      sessions.set(hash, { id: "synthetic-user", role, csrf_hash: csrfHash, expires_at: new Date(Date.now() + 3_600_000).toISOString() });
      return { id: "synthetic-user", role };
    },
    async getSession(hash) { return sessions.get(hash); },
    async revoke(hash) { sessions.delete(hash); },
    async revokeAll() { sessions.clear(); },
    async recordDenied() {},
  };
  const provider = {
    async begin() { return { state: "test-state", nonce: "test-nonce", verifier: "test-verifier", url: "https://id.example.invalid/authorize" }; },
    async complete(url, flow) {
      assert.equal(url.origin, "https://api.example.invalid");
      if (url.searchParams.get("state") !== flow.state) throw new Error("invalid state");
      return { issuer: "https://id.example.invalid", subject: "test-subject" };
    },
  };
  const settings = { secure: true, callbackUrl: "https://api.example.invalid/api/auth/callback", portalOrigin: "https://portal.example.invalid" };
  const auth = createStaffAuth({ store, provider, settings, limiter: createLimiter({ limit: 30, windowMs: 60_000 }) });
  // Protected synthetic route tests the same authoritative owner middleware used
  // by future settings/session administration, not browser-only role gating.
  auth.router.post("/owner-test", auth.requireStaff, auth.requireMutation, auth.requireOwner, (_req, res) => res.sendStatus(204));
  const server = createApp({ staffAuth: auth, repository: { async listLeads() { return []; } } }).listen(0, "127.0.0.1");
  await once(server, "listening"); context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, init = {}) => fetch(base + path, { redirect: "manual", ...init });
  assert.equal((await request("/api/agent/leads")).status, 401);
  assert.equal((await request("/api/auth/login?remember=unexpected")).status, 400);
  assert.equal((await request("/api/auth/login?remember=1&remember=0")).status, 400);
  const begin = await request("/api/auth/login");
  assert.equal(begin.status, 303);
  const flowCookie = begin.headers.get("set-cookie").split(";")[0];
  assert.match(begin.headers.get("set-cookie"), /HttpOnly/);
  assert.match(begin.headers.get("set-cookie"), /Secure/);
  assert.match(begin.headers.get("set-cookie"), /SameSite=Lax/);
  const complete = await request("/api/auth/callback?state=test-state", { headers: { cookie: flowCookie, "x-forwarded-host": "attacker.invalid" } });
  assert.equal(complete.status, 303);
  assert.equal(complete.headers.get("location"), settings.portalOrigin);
  assert.doesNotMatch(complete.headers.getSetCookie().find((value) => value.startsWith("__Host-twe_session=")), /Max-Age|Expires=/);
  const sessionCookie = complete.headers.getSetCookie().find((value) => value.startsWith("__Host-twe_session=")).split(";")[0];
  const sessionResponse = await request("/api/auth/session", { headers: { cookie: sessionCookie } });
  const payload = (await sessionResponse.json()).data;
  assert.equal(payload.user.role, "editor");
  assert.equal(payload.user.organisationId, "synthetic-org");
  assert.equal((await request("/api/agent/leads", { headers: { cookie: sessionCookie } })).status, 200);
  assert.equal((await request("/api/auth/session", { headers: { cookie: sessionCookie, origin: "https://public.example.invalid" } })).status, 403);
  assert.equal((await request("/api/auth/callback?state=test-state", { headers: { cookie: flowCookie } })).status, 401);
  assert.equal((await request("/api/auth/logout", { method: "POST", headers: { cookie: sessionCookie } })).status, 403);
  const headers = { cookie: sessionCookie, origin: settings.portalOrigin, "X-CSRF-Token": payload.csrfToken };
  assert.equal((await request("/api/auth/logout", { method: "POST", headers: { ...headers, origin: "https://attacker.invalid" } })).status, 403);
  assert.equal((await request("/api/auth/owner-test", { method: "POST", headers })).status, 403);
  assert.equal((await request("/api/auth/logout", { method: "POST", headers })).status, 200);
  assert.equal((await request("/api/auth/session", { headers: { cookie: sessionCookie } })).status, 401);
  deniedIdentity = true; role = "owner";
  const second = await request("/api/auth/login");
  const secondCookie = second.headers.get("set-cookie").split(";")[0];
  assert.equal((await request("/api/auth/callback?state=test-state", { headers: { cookie: secondCookie } })).status, 401);
  deniedIdentity = false;
  const ownerBegin = await request("/api/auth/login?remember=1");
  const ownerComplete = await request("/api/auth/callback?state=test-state", { headers: { cookie: ownerBegin.headers.get("set-cookie").split(";")[0] } });
  const ownerCookie = ownerComplete.headers.getSetCookie().find((value) => value.startsWith("__Host-twe_session=")).split(";")[0];
  assert.match(ownerComplete.headers.getSetCookie().find((value) => value.startsWith("__Host-twe_session=")), /Max-Age=3600/);
  const ownerSession = (await (await request("/api/auth/session", { headers: { cookie: ownerCookie } })).json()).data;
  const ownerHeaders = { cookie: ownerCookie, origin: settings.portalOrigin, "X-CSRF-Token": ownerSession.csrfToken };
  assert.equal((await request("/api/auth/owner-test", { method: "POST", headers: ownerHeaders })).status, 204);
  const stored = [...sessions.values()][0];
  stored.expires_at = new Date(Date.now() - 1).toISOString();
  assert.equal((await request("/api/auth/session", { headers: ownerHeaders })).status, 401);
  stored.expires_at = new Date(Date.now() + 60_000).toISOString();
  assert.equal((await request("/api/auth/logout-all", { method: "POST", headers: ownerHeaders })).status, 200);
  assert.equal(sessions.size, 0);
  assert.equal((await request("/api/auth/session", { headers: ownerHeaders })).status, 401);
});

test("unconfigured staff login reports unavailable without a token fallback", async (context) => {
  const auth = createStaffAuth({ limiter: createLimiter({ limit: 10, windowMs: 60_000 }) });
  const server = createApp({ staffAuth: auth, agentToken: "legacy-token-must-not-work" }).listen(0, "127.0.0.1");
  await once(server, "listening"); context.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base + "/api/auth/login")).status, 503);
  assert.equal((await fetch(base + "/api/agent/leads", { headers: { authorization: "Bearer legacy-token-must-not-work" } })).status, 401);
});
