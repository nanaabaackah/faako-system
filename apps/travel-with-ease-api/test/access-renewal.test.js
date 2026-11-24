// Issue 03: synthetic, locally signed assertions only; no hosted sessions.
import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose";
import { createAccessVerifier } from "../src/auth/access.js";
import { createStaffAuth } from "../src/auth/routes.js";
import { createApp, createLimiter } from "../src/app.js";

test("Issue 03: renewed assertions preserve a fixed session and CSRF without weakening identity checks", async (context) => {
  const settings = {
    mode: "cloudflare_access", secure: true,
    issuer: "https://synthetic.cloudflareaccess.com", audience: "a".repeat(64),
    portalOrigin: "https://portal.example.invalid",
  };
  const pairs = await Promise.all([generateKeyPair("RS256"), generateKeyPair("RS256")]);
  const keys = await Promise.all(pairs.map(async (pair, index) => ({
    ...await exportJWK(pair.publicKey), alg: "RS256", kid: `synthetic-${index}`,
  })));
  const provider = createAccessVerifier(settings, createLocalJWKSet({ keys }));
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: settings.issuer, aud: [settings.audience], sub: "synthetic-editor",
    type: "app", identity_nonce: "initial-nonce", iat: now, nbf: now, exp: now + 300,
  };
  const sign = (changes = {}, index = 0) => new SignJWT({ ...claims, ...changes })
    .setProtectedHeader({ alg: "RS256", kid: keys[index].kid })
    .sign(pairs[index].privateKey);
  const original = await sign();
  // Also exercise a signing-key change; both synthetic keys are trusted here.
  const renewed = await sign({ identity_nonce: "renewed-nonce", exp: now + 3600 }, 1);
  const sessions = new Map();
  const used = new Set();
  let denials = 0;
  let writes = 0;
  const store = {
    organisationId: "synthetic-tenant",
    async createSession(identity, tokenHash, csrfHash) {
      if (used.has(identity.assertionHash)) throw new Error("Replay");
      used.add(identity.assertionHash);
      sessions.set(tokenHash, {
        id: "synthetic-editor", role: "editor", issuer: identity.issuer,
        subject: identity.subject, access_audience: identity.audience,
        access_assertion_hash: identity.assertionHash, csrf_hash: csrfHash,
        expires_at: identity.expiresAt,
      });
      return { id: "synthetic-editor" };
    },
    async getSession(tokenHash) { return sessions.get(tokenHash); },
    async revoke(tokenHash) { sessions.delete(tokenHash); },
    async revokeAll() { sessions.clear(); },
    async recordDenied() { denials++; },
  };
  const mount = () => {
    const auth = createStaffAuth({
      store, settings, provider, limiter: createLimiter({ limit: 100, windowMs: 60000 }),
    });
    auth.router.post("/synthetic-draft", auth.requireStaff, auth.requireMutation,
      auth.requirePermission("content.write"), (_req, res) => { writes++; res.sendStatus(204); });
    return createApp({ staffAuth: auth });
  };
  let server = mount().listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  let base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const login = await fetch(`${base}/access-session`, {
    method: "POST", headers: {
      origin: settings.portalOrigin, "X-TWE-Session-Init": "1",
      "Cf-Access-Jwt-Assertion": original,
    },
  });
  assert.equal(login.status, 201);
  const setCookie = login.headers.get("set-cookie");
  assert.match(setCookie, /^__Host-twe_session=/);
  for (const flag of [/; HttpOnly/i, /; Secure/i, /; SameSite=Lax/i, /; Path=\//i]) assert.match(setCookie, flag);
  assert.doesNotMatch(setCookie, /; Domain=/i);
  const cookieExpiry = Date.parse(setCookie.match(/; Expires=([^;]+)/i)?.[1]);
  assert.equal(cookieExpiry, claims.exp * 1000, "Persistent cookie cannot outlive the verified Access assertion");
  const cookie = setCookie.split(";")[0];
  const request = (assertion, route = "/session", options = {}) => fetch(`${base}${route}`, {
    ...options, headers: { cookie, "Cf-Access-Jwt-Assertion": assertion, ...options.headers },
  });
  const first = await (await request(original)).json();
  const before = structuredClone([...sessions.values()][0]);
  const checkRenewed = await request(renewed);
  assert.equal(checkRenewed.status, 200, "A renewed verified identity must retain its local session");
  assert.equal(checkRenewed.headers.get("set-cookie"), null);
  assert.deepEqual((await checkRenewed.json()).data, first.data);
  assert.deepEqual([...sessions.values()][0], before, "Renewal must not slide expiry, replace CSRF or rewrite the login hash");
  assert.equal(sessions.size, 1);

  // A new middleware instance retains persisted session semantics, not JWT memory.
  await new Promise((resolve) => server.close(resolve));
  server = mount().listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}/api/auth`;
  assert.equal((await request(renewed)).status, 200);
  const bound = [...sessions.values()][0];
  for (const field of ["issuer", "subject", "access_audience"]) {
    const value = bound[field];
    bound[field] = "different-binding";
    assert.equal((await request(renewed)).status, 401, `Verified JWT must still match session ${field}`);
    bound[field] = value;
  }
  for (const changes of [
    { sub: "other-user" }, { iss: "https://other.cloudflareaccess.com" },
    { aud: ["b".repeat(64)] }, { exp: now - 1 }, { nbf: now + 60 },
    { service_token_id: "machine" },
  ]) assert.equal((await request(await sign(changes))).status, 401);
  assert.equal((await request("forged.assertion.value")).status, 401);
  assert.equal((await fetch(`${base}/session`, { headers: { cookie } })).status, 401);
  assert.equal((await fetch(`${base}/session`, { headers: { "Cf-Access-Jwt-Assertion": renewed } })).status, 401);
  const mutation = {
    method: "POST", headers: { origin: settings.portalOrigin, "X-CSRF-Token": first.data.csrfToken },
  };
  assert.equal((await request(renewed, "/synthetic-draft", { method: "POST" })).status, 403);
  assert.equal((await request(renewed, "/synthetic-draft", {
    ...mutation, headers: { ...mutation.headers, "X-CSRF-Token": "wrong" },
  })).status, 403);
  assert.equal((await request(renewed, "/synthetic-draft", {
    ...mutation, headers: { ...mutation.headers, origin: "https://attacker.invalid" },
  })).status, 403);
  assert.equal((await request(renewed, "/synthetic-draft", mutation)).status, 204);
  assert.equal(writes, 1);

  const stored = [...sessions.values()][0];
  stored.expires_at = new Date(Date.now() - 1);
  assert.equal((await request(renewed)).status, 401, "Renewal cannot revive an expired application session");
  stored.expires_at = before.expires_at;
  assert.equal((await request(renewed, "/logout", mutation)).status, 200);
  assert.equal((await request(renewed)).status, 401, "Renewal cannot revive a revoked application session");
  const replay = await fetch(`${base}/access-session`, {
    ...mutation, headers: { ...mutation.headers, "X-TWE-Session-Init": "1", "Cf-Access-Jwt-Assertion": original },
  });
  assert.equal(replay.status, 401, "Original exchange replay prevention remains intact");
  assert.ok(denials >= 7);
});
