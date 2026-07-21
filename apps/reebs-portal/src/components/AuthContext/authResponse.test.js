import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeAuthUser } from "./authResponse.js";

test("frontend accepts a safe cookie-session login response without a token", () => {
  const user = sanitizeAuthUser({
    id: 7,
    email: "owner@example.com",
    role: "owner",
    organizationId: 2,
    authenticatedAt: "2026-07-18T10:00:00.000Z",
  });

  assert.deepEqual(user, {
    id: 7,
    email: "owner@example.com",
    role: "owner",
    organizationId: 2,
    authenticatedAt: "2026-07-18T10:00:00.000Z",
  });
});

test("frontend strips legacy token and sensitive user fields before persistence", () => {
  const user = sanitizeAuthUser({
    id: 7,
    token: "legacy-token",
    password: "hash",
    loginAttempts: 4,
    lockedUntil: "tomorrow",
    sessionToken: "session-token",
    sessionTokenId: "session-id",
  });

  assert.deepEqual(user, { id: 7 });
});
