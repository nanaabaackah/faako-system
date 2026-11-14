import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  CONTINUATION_TTL_MS,
  createContinuationLinks,
  readContinuationConfig,
} from "../src/enquiries/continuation-links.js";

const secret = randomBytes(32).toString("base64url");
const now = Date.parse("2026-11-13T10:00:00.000Z");

test("continuation configuration is server-only, complete and environment scoped", () => {
  assert.equal(readContinuationConfig({ APP_ENV: "test" }), null);
  assert.throws(() => readContinuationConfig({
    APP_ENV: "production", TWE_ENQUIRY_CONTINUATION_SECRET: secret,
  }), /TWE_PUBLIC_SITE_ORIGIN/);
  assert.throws(() => readContinuationConfig({
    APP_ENV: "production", TWE_ENQUIRY_CONTINUATION_SECRET: "short",
    TWE_PUBLIC_SITE_ORIGIN: "https://travelwitheasegh.com",
  }), /at least 32 bytes/);
  assert.throws(() => readContinuationConfig({
    APP_ENV: "production", TWE_ENQUIRY_CONTINUATION_SECRET: secret,
    TWE_PUBLIC_SITE_ORIGIN: "http://travelwitheasegh.com",
  }), /HTTPS origin/);
});

test("signed continuation links use a fragment, fixed lifetime and reject tampering or expiry", () => {
  let clock = now;
  const links = createContinuationLinks({
    secret, origin: "https://travelwitheasegh.com", clock: () => clock,
  });
  const id = randomUUID();
  const issued = links.issue(id);
  assert.match(issued.url, /^https:\/\/travelwitheasegh\.com\/plan-your-trip#continue=v1\./);
  assert.doesNotMatch(new URL(issued.url).pathname + new URL(issued.url).search, /v1\.|continue/);
  assert.equal(Date.parse(issued.expiresAt) - now, CONTINUATION_TTL_MS);
  assert.deepEqual(links.verify(issued.token), { enquiryId: id, expiresAt: issued.expiresAt });
  assert.equal(links.verify(`${issued.token.slice(0, -1)}x`), null);
  assert.equal(links.verify(issued.token.replace(id, "00000000-0000-0000-0000-000000000000")), null);
  clock = now + CONTINUATION_TTL_MS;
  assert.equal(links.verify(issued.token), null);
  assert.throws(() => links.issue("not-an-id"));
  assert.throws(() => createContinuationLinks({
    secret, origin: "https://travelwitheasegh.com", ttlMs: 1,
  }), /14 days/);
});
