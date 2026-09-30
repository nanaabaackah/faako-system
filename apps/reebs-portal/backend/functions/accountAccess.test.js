import assert from "node:assert/strict";
import test from "node:test";
import {
  accountAccessSecretsMatch,
  hashAccountAccessToken,
  isValidAccountActivationPassword,
} from "./accountAccess.js";

test("account activation tokens are stored as deterministic hashes", () => {
  const token = "invitation-token-that-is-long-enough-for-testing";
  const hashed = hashAccountAccessToken(token);
  assert.equal(hashed, hashAccountAccessToken(token));
  assert.notEqual(hashed, token);
  assert.match(hashed, /^[a-f0-9]{64}$/);
});

test("bootstrap setup code comparison is exact and timing safe", () => {
  assert.equal(accountAccessSecretsMatch("correct-setup-code", "correct-setup-code"), true);
  assert.equal(accountAccessSecretsMatch("correct-setup-code", "wrong-setup-code"), false);
  assert.equal(accountAccessSecretsMatch("", ""), false);
});

test("account activation requires a 12 character password", () => {
  assert.equal(isValidAccountActivationPassword("short-pass"), false);
  assert.equal(isValidAccountActivationPassword("long-password"), true);
});
