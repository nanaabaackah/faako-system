import test from "node:test";
import assert from "node:assert/strict";
import { createTurnstileVerifier } from "../src/enquiries/turnstile.js";
import { submissionRecord } from "../src/enquiries/submission.js";

const origin = "https://staging.travelwitheasegh.com";
const passed = { success: true, hostname: "staging.travelwitheasegh.com", action: "twe_enquiry" };
const input = { token: "synthetic-one-time-token", origin };
const setup = result => createTurnstileVerifier({
  environment: "staging", secret: "synthetic-server-only-secret",
  fetchImpl: async (url, options) => {
    assert.equal(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("response"), input.token);
    assert.ok(options.signal);
    return { ok: true, json: async () => result };
  },
});

test("hosted Turnstile verifies the result, exact hostname and expected action", async () => {
  await setup(passed)(input);
  for (const result of [
    { ...passed, success: false }, { ...passed, success: "true" },
    { ...passed, hostname: "travelwitheasegh.com" },
    { ...passed, action: "different-form" }, null,
  ]) await assert.rejects(setup(result)(input), error => error.status === 400);
  await assert.rejects(setup(passed)({ ...input, token: "" }), error => error.status === 400);
  await assert.rejects(setup(passed)({ ...input, token: "x".repeat(2049) }), error => error.status === 400);
  await assert.rejects(setup(passed)({ ...input, origin: "https://attacker.invalid" }), error => error.status === 403);
});

test("missing/dummy hosted secrets and provider failures cannot allow persistence", async () => {
  assert.equal(createTurnstileVerifier({ environment: "development" }), null);
  for (const secret of ["", "1x0000000000000000000000000000000AA"]) {
    await assert.rejects(createTurnstileVerifier({ environment: "production", secret })(input),
      error => error.status === 503);
  }
  const unavailable = createTurnstileVerifier({
    environment: "staging", secret: "synthetic-server-only-secret",
    fetchImpl: async () => { throw new Error("private provider diagnostic"); },
  });
  await assert.rejects(unavailable(input), error =>
    error.status === 503 && !error.message.includes("private provider diagnostic"));
});

test("challenge tokens are excluded from persisted enquiry details and replay fingerprints", () => {
  const data = { submissionId: "synthetic-id", name: "Synthetic", email: "synthetic@example.invalid",
    phone: "+233200000000", consent: true, website: "", enquiryType: "trip",
    turnstileToken: "first-token" };
  const first = submissionRecord(data);
  const refreshed = submissionRecord({ ...data, turnstileToken: "refreshed-token" });
  assert.equal(first.fingerprint, refreshed.fingerprint);
  assert.equal("turnstileToken" in first.details, false);
});
