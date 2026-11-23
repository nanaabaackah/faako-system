import test from "node:test";
import assert from "node:assert/strict";
import { PagesProvider } from "../src/content/pages-provider.js";
import { reconcileStalePublication } from "../src/content/publication-worker.js";
import { runPublicationLoop } from "../src/content/publication-loop.js";
import { PublicationRepository, manifestDigest } from "../src/content/publication.js";

const sha = "a".repeat(40);
const job = {
  id: "f1f1f1f1-1111-4111-8111-111111111111",
  build_token: "lease-token",
  source_sha: sha,
  status: "deploying",
  created_at: "2026-11-23T08:00:00Z",
  manifest: { version: 1, pages: [{ id: "content-id", slug: "home", revisionId: "revision-id", body: { heading: "Published" } }] },
};
const deployment = (id, branch = "develop", source = sha) => ({
  id,
  url: `https://${id}.twe-concierge.pages.dev`,
  created_on: "2026-11-23T08:02:00Z",
  latest_stage: { status: "success" },
  environment: "preview",
  deployment_trigger: { metadata: { branch, commit_hash: source } },
});
const provider = (deployments) => new PagesProvider({
  accountId: "a".repeat(32), project: "twe-concierge", environment: "staging",
  branch: "develop", origin: "https://staging.travelwitheasegh.com", token: "synthetic",
}, {
  fetcher: async url => ({
    ok: true,
    json: async () => ({ success: true, result: url.includes("?per_page=25")
      ? deployments : { production_branch: "main", name: "twe-concierge", subdomain: "twe-concierge.pages.dev" } }),
  }),
});

test("reconciliation selects only the one matching immutable deployment, then verifies the live origin", async () => {
  const first = deployment("11111111-1111-4111-8111-111111111111");
  const other = deployment("22222222-2222-4222-8222-222222222222", "main");
  const visited = [];
  const marker = { jobId: job.id, sourceSha: sha, digest: manifestDigest(job.manifest) };
  const result = await provider([other, first]).findPublicationDeployment(job, async (origin, proof) => {
    visited.push(origin);
    assert.deepEqual(proof, marker);
  }, marker);
  assert.equal(result.id, first.id);
  assert.deepEqual(visited, [first.url, "https://staging.travelwitheasegh.com"]);
});

test("reconciliation does not confirm an ambiguous, missing or unverified deployment", async () => {
  const first = deployment("11111111-1111-4111-8111-111111111111");
  const second = deployment("22222222-2222-4222-8222-222222222222");
  const marker = { jobId: job.id, sourceSha: sha, digest: manifestDigest(job.manifest) };
  assert.equal(await provider([]).findPublicationDeployment(job, async () => {}, marker), null);
  assert.equal(await provider([first, second]).findPublicationDeployment(job, async () => {}, marker), null);
  await assert.rejects(provider([first]).findPublicationDeployment(job, async origin => {
    if (origin === "https://staging.travelwitheasegh.com") throw new Error("Custom domain is not current.");
  }, marker), /Custom domain/);
});

test("stale publication confirms only after matching the exact provider artifact and marker", async () => {
  const calls = [];
  const publication = {
    staleDeployment: async () => job,
    confirmReconciled: async (...args) => { calls.push(args); },
    confirmed: async () => null,
  };
  const result = await reconcileStalePublication({
    publication,
    provider: { findPublicationDeployment: async (row, verify, marker) => {
      assert.equal(row, job);
      assert.deepEqual(marker, { jobId: job.id, sourceSha: sha, digest: manifestDigest(job.manifest) });
      return { id: "33333333-3333-4333-8333-333333333333" };
    } },
  });
  assert.equal(result.status, "live");
  assert.deepEqual(calls, [[job.id, job.build_token, "33333333-3333-4333-8333-333333333333", manifestDigest(job.manifest)]]);
});

test("missing provider evidence preserves a blocked publication and never changes the database", async () => {
  let confirmed = false;
  const publication = {
    staleDeployment: async () => job,
    confirmReconciled: async () => { confirmed = true; },
    confirmed: async () => null,
  };
  const result = await reconcileStalePublication({
    publication,
    provider: { findPublicationDeployment: async () => null },
  });
  assert.equal(result.status, "recovery_required");
  assert.equal(confirmed, false);
});

test("database reconciliation confirms only the stale leased job and leaves an audit trail", async () => {
  const queries = [];
  const client = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes("SELECT * FROM twe.publication_jobs")) return { rows: [job], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    release: () => {},
  };
  const repository = new PublicationRepository({ connect: async () => client }, {
    organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", environment: "staging", sourceSha: sha,
  });
  await repository.confirmReconciled(job.id, job.build_token, "33333333-3333-4333-8333-333333333333", manifestDigest(job.manifest));
  assert.match(queries.find(q => q.sql.includes("SELECT * FROM twe.publication_jobs")).sql, /status IN \('deploying', 'verifying'\).*updated_at <= now\(\) - interval '10 minutes'/);
  assert.ok(queries.some(q => q.sql.includes("UPDATE twe.content_items")));
  assert.ok(queries.some(q => q.sql.includes("UPDATE twe.publication_jobs SET status = 'live'")));
  assert.ok(queries.some(q => q.sql.includes("INSERT INTO twe.audit_records") && q.params.includes("content.deployment_reconciled")));
  assert.equal(queries.at(-1).sql, "COMMIT");
});

test("continuous worker remains alive for bounded reconciliation but stops on missing proof", async () => {
  const statuses = ["deploying", "verifying", "recovery_required"];
  const calls = [];
  const result = await runPublicationLoop({
    runOnce: async () => { const status = statuses.shift(); calls.push(status); return { status }; },
    sleep: async () => {},
    intervalMs: 1000,
  });
  assert.deepEqual(calls, ["deploying", "verifying", "recovery_required"]);
  assert.equal(result.status, "recovery_required");
});
