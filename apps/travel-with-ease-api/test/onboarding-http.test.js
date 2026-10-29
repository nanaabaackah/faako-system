import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import { createStaffAuth } from "../src/auth/routes.js";
import { invitationRoutes } from "../src/onboarding/invitation-routes.js";
import { tutorialRoutes } from "../src/onboarding/routes.js";
import { isAllowedPortalApiRoute } from "../src/portal/proxy.js";

test("activation requires verified Access and same-origin custom-header POST; no session permissions leak", async (context) => {
  let claims = 0;
  const origin = "https://portal.example.invalid";
  const identity = {
    issuer: "https://synthetic.cloudflareaccess.com",
    audience: "a".repeat(64),
    subject: "verified-subject",
  };
  const auth = createStaffAuth({
    limiter: (_req, _res, next) => next(),
    settings: { mode: "cloudflare_access", portalOrigin: origin },
    store: {},
    provider: {
      verify: async (assertion) => {
        if (assertion !== "synthetic") throw new Error("Invalid");
        return identity;
      },
    },
  });
  auth.router.use(
    invitationRoutes(
      {
        identityStatus: async (value) => ({
          status: "invitation_required",
          subject: value.subject,
        }),
        claim: async () => {
          claims++;
          return { activated: true };
        },
      },
      auth,
    ),
  );
  auth.router.use(
    tutorialRoutes(
      {
        run: async () => {
          throw new Error("Must not reach progress without a session");
        },
      },
      auth,
    ),
  );
  const app = express();
  app.use(express.json());
  app.use("/api/auth", auth.router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (headers) =>
    fetch(`${base}/activation/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ code: "a".repeat(43) }),
    });
  assert.equal((await fetch(`${base}/activation`)).status, 401);
  assert.equal(
    (await post({ Origin: origin, "X-TWE-Session-Init": "1" })).status,
    401,
  );
  assert.equal(
    (
      await post({
        "Cf-Access-Jwt-Assertion": "synthetic",
        Origin: "https://attacker.invalid",
        "X-TWE-Session-Init": "1",
      })
    ).status,
    403,
  );
  assert.equal(
    (await post({ "Cf-Access-Jwt-Assertion": "synthetic", Origin: origin }))
      .status,
    403,
  );
  assert.equal(
    (
      await post({
        "Cf-Access-Jwt-Assertion": "synthetic",
        Origin: origin,
        "X-TWE-Session-Init": "1",
      })
    ).status,
    200,
  );
  assert.equal(claims, 1);
  assert.equal(
    (
      await fetch(`${base}/tutorials`, {
        headers: { "Cf-Access-Jwt-Assertion": "synthetic" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${base}/invitations`, {
        headers: { "Cf-Access-Jwt-Assertion": "synthetic" },
      })
    ).status,
    401,
  );
});
test("portal permits only reviewed onboarding methods and paths", () => {
  for (const [method, path] of [
    ["GET", "activation"],
    ["GET", "tutorials"],
    ["POST", "tutorials"],
    ["POST", "activation/claim"],
    ["GET", "invitations"],
    ["POST", "invitations"],
  ])
    assert.equal(isAllowedPortalApiRoute(method, `/api/auth/${path}`), true);
  for (const [method, path] of [
    ["GET", "activation/claim"],
    ["DELETE", "tutorials"],
    ["POST", "tutorials/other-user"],
    ["POST", "activation/platform-admin"],
  ])
    assert.equal(isAllowedPortalApiRoute(method, `/api/auth/${path}`), false);
});
