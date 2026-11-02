import test from "node:test";
import assert from "node:assert/strict";
import {
  PublicationRepository,
  manifestDigest,
} from "../src/content/publication.js";
import { verifyPublishedMarker } from "../src/content/artifact.js";

test("publication digest is stable across PostgreSQL jsonb key ordering", () => {
  assert.equal(
    manifestDigest({ b: { z: 1, a: 2 }, a: [1, 2] }),
    manifestDigest({ a: [1, 2], b: { a: 2, z: 1 } }),
  );
  assert.notEqual(manifestDigest({ a: [1, 2] }), manifestDigest({ a: [2, 1] }));
});
test("publication serialization is transaction-scoped and tenant/environment-bound without broader grants", async () => {
  const calls = [];
  const client = { query: async (...args) => calls.push(args) };
  for (const environment of ["staging", "production"]) {
    for (const organisationId of ["tenant-a", "tenant-b"]) {
      await new PublicationRepository(null, {
        environment,
        organisationId,
      }).lockOrganisation(client);
    }
  }
  assert.ok(
    calls.every(
      ([sql]) =>
        sql === "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    ),
  );
  assert.equal(new Set(calls.map(([, params]) => params[0])).size, 4);
  assert.doesNotMatch(JSON.stringify(calls), /FOR UPDATE|GRANT/);
});
test("publication acknowledgement verifies exact origin and deployment marker", async () => {
  const marker = {
    jobId: "synthetic",
    sourceSha: "a".repeat(40),
    digest: "b".repeat(64),
  };
  const fetcher = async (url, options) => {
    assert.equal(
      url.href,
      "https://stage.example.invalid/twe-publication.json",
    );
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    return { ok: true, json: async () => marker };
  };
  await verifyPublishedMarker("https://stage.example.invalid", marker, fetcher);
  await assert.rejects(
    verifyPublishedMarker("http://stage.example.invalid", marker, fetcher),
  );
  await assert.rejects(
    verifyPublishedMarker(
      "https://stage.example.invalid/path",
      marker,
      fetcher,
    ),
  );
  await assert.rejects(
    verifyPublishedMarker(
      "https://stage.example.invalid",
      { ...marker, digest: "wrong" },
      fetcher,
    ),
  );
  await assert.rejects(
    verifyPublishedMarker(
      "https://stage.example.invalid",
      marker,
      async () => ({ ok: false }),
    ),
  );
});
