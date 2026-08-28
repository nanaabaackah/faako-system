/* eslint-disable no-undef */
import assert from "node:assert/strict";
import test from "node:test";
import { buildSuccessfulLoginResponse, handler } from "./login.js";
import { getUserFromEvent, signUserToken } from "./_shared/userAuth.js";

test("invalid login input is rejected before database access", async () => {
  const response = await handler({
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "", password: "" }),
  });
  const payload = JSON.parse(response.body);
  assert.equal(response.statusCode, 400);
  assert.equal(payload.apiError.code, "validation_error");
  assert.ok(Array.isArray(payload.apiError.issues));
});

test("successful login sets an HttpOnly cookie without returning sensitive fields", () => {
  const previousSecret = process.env.USER_APP_SECRET;
  process.env.USER_APP_SECRET = "test-user-app-secret";

  try {
    const response = buildSuccessfulLoginResponse(
      { headers: { host: "portal.example.com", "x-forwarded-proto": "https" } },
      {
        user: {
          id: 7,
          firstName: "Nana",
          lastName: "Owner",
          fullName: "Nana Owner",
          email: "owner@example.com",
          personalEmail: "nana@example.com",
          role: "owner",
          organizationId: 2,
          password: "password-hash",
          loginAttempts: 3,
          lockedUntil: new Date(),
        },
        session: {
          createdAt: "2026-07-18T10:00:00.000Z",
          lastSeenAt: "2026-07-18T10:00:00.000Z",
        },
        token: "signed-session-token",
        sessionTtlMs: 60 * 60 * 1000,
      }
    );

    const payload = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.match(response.headers["Set-Cookie"], /^reebs_user_session=/);
    assert.match(response.headers["Set-Cookie"], /HttpOnly/);
    assert.match(response.headers["Set-Cookie"], /Secure/);
    assert.equal("token" in payload, false);
    assert.equal("password" in payload, false);
    assert.equal("loginAttempts" in payload, false);
    assert.equal("lockedUntil" in payload, false);
  } finally {
    if (previousSecret === undefined) delete process.env.USER_APP_SECRET;
    else process.env.USER_APP_SECRET = previousSecret;
  }
});

test("cookie-based session token validation remains functional", () => {
  const previousSecret = process.env.USER_APP_SECRET;
  process.env.USER_APP_SECRET = "test-user-app-secret";

  try {
    const response = buildSuccessfulLoginResponse(
      { headers: { host: "localhost:5174", "x-forwarded-proto": "http" } },
      {
        user: { id: 7, organizationId: 2, role: "owner" },
        session: { createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() },
        token: "not-a-valid-signed-token",
        sessionTtlMs: 60 * 60 * 1000,
      }
    );
    assert.match(response.headers["Set-Cookie"], /HttpOnly/);

    const token = signUserToken({ userId: 7, organizationId: 2, role: "owner" }, 60_000);
    const user = getUserFromEvent({
      headers: { cookie: `reebs_user_session=${encodeURIComponent(token)}` },
    });
    assert.equal(user.userId, 7);
    assert.equal(user.organizationId, 2);
  } finally {
    if (previousSecret === undefined) delete process.env.USER_APP_SECRET;
    else process.env.USER_APP_SECRET = previousSecret;
  }
});
