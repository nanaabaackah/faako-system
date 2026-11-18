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

test("stale unclaimed publication can be cancelled with an atomic audit entry", async () => {
  const organisationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const jobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const statements = [];
  let released = false;
  const client = {
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes("UPDATE twe.publication_jobs")) return { rowCount: 1, rows: [{ id: jobId, status: "failed" }] };
      return { rowCount: 0, rows: [] };
    },
    release: () => { released = true; },
  };
  const repo = new PublicationRepository({ connect: async () => client }, { organisationId, environment: "staging" });
  const cancelled = await repo.cancelPending(jobId, { id: organisationId, organisationId }, "cancel-stale-20261118");
  assert.deepEqual(cancelled, { id: jobId, status: "cancelled" });
  assert.equal(statements[0].sql, "BEGIN");
  const update = statements.find(({ sql }) => sql.includes("UPDATE twe.publication_jobs"));
  assert.match(update.sql, /status = 'pending'/);
  assert.match(update.sql, /created_at <= now\(\) - interval '30 minutes'/);
  assert.match(update.sql, /last_error = 'cancelled_by_operator'/);
  assert.deepEqual(update.params, [jobId, organisationId, "staging"]);
  const audit = statements.find(({ sql }) => sql.includes("INSERT INTO twe.audit_records"));
  assert.ok(audit, "cancel must create an immutable audit entry");
  assert.ok(audit.params.includes("content.publication_cancelled"));
  assert.equal(statements.at(-1).sql, "COMMIT");
  assert.equal(released, true);
});
test("claimed, fresh and cross-organisation jobs cannot be cancelled", async () => {
  const organisationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const jobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const statements = [];
  const client = {
    query: async (sql) => {
      statements.push(sql);
      return { rowCount: 0, rows: [] };
    },
    release: () => {},
  };
  const repo = new PublicationRepository({ connect: async () => client }, { organisationId, environment: "staging" });
  await assert.rejects(repo.cancelPending(jobId, { id: organisationId, organisationId: "other-org" }, "no-access"), { status: 403 });
  assert.equal(statements.length, 0);
  await assert.rejects(repo.cancelPending(jobId, { id: organisationId, organisationId }, "in-flight"), { status: 409 });
  assert.ok(statements.includes("ROLLBACK"));
  assert.equal(statements.some(sql => sql.includes("INSERT INTO twe.audit_records")), false);
});
