import test from "node:test";
import assert from "node:assert/strict";
import { manifestDigest } from "../src/content/publication.js";
import { verifyPublishedMarker } from "../src/content/artifact.js";

test("publication digest is stable across PostgreSQL jsonb key ordering", () => {
  assert.equal(manifestDigest({ b: { z: 1, a: 2 }, a: [1, 2] }), manifestDigest({ a: [1, 2], b: { a: 2, z: 1 } }));
  assert.notEqual(manifestDigest({ a: [1, 2] }), manifestDigest({ a: [2, 1] }));
});
test("publication acknowledgement verifies exact origin and deployment marker", async () => {
  const marker = { jobId: "synthetic", sourceSha: "a".repeat(40), digest: "b".repeat(64) };
  const fetcher = async (url, options) => {
    assert.equal(url.href, "https://stage.example.invalid/twe-publication.json");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    return { ok: true, json: async () => marker };
  };
  await verifyPublishedMarker("https://stage.example.invalid", marker, fetcher);
  await assert.rejects(verifyPublishedMarker("http://stage.example.invalid", marker, fetcher));
  await assert.rejects(verifyPublishedMarker("https://stage.example.invalid/path", marker, fetcher));
  await assert.rejects(verifyPublishedMarker("https://stage.example.invalid", { ...marker, digest: "wrong" }, fetcher));
  await assert.rejects(verifyPublishedMarker("https://stage.example.invalid", marker, async () => ({ ok: false })));
});
