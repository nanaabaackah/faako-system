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

test("reconciliation locates an older deployment beyond Cloudflare's first page", async () => {
  const old = deployment("33333333-3333-4333-8333-333333333333");
  const unrelated = Array.from({ length: 25 }, (_, i) => deployment(
    `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`, "main",
  ));
  const pagesRead = [], originsVerified = [];
  const p = new PagesProvider({
    accountId: "a".repeat(32), project: "twe-concierge", environment: "staging",
    branch: "develop", origin: "https://staging.travelwitheasegh.com", token: "synthetic",
  }, {
    fetcher: async url => ({
      ok: true,
      json: async () => {
        const query = new URL(url).searchParams;
        if (!url.includes("/deployments?")) return { success: true, result: {
          production_branch: "main", name: "twe-concierge",
          subdomain: "twe-concierge.pages.dev",
        } };
        const page = Number(query.get("page"));
        pagesRead.push(page);
        return { success: true, result: page === 1 ? unrelated : page === 2 ? [old] : [] };
      },
    }),
  });
  const marker = { jobId: job.id, sourceSha: sha, digest: manifestDigest(job.manifest) };
  const found = await p.findPublicationDeployment(job, async (origin, expected) => {
    originsVerified.push(origin);
    assert.deepEqual(expected, marker);
  }, marker);
  assert.equal(found.id, old.id);
  assert.deepEqual(pagesRead, [1, 2]);
  assert.deepEqual(originsVerified, [old.url, "https://staging.travelwitheasegh.com"]);
});

test("reconciliation refuses multiple marker-matching deployments across Pages pages", async () => {
  const first = deployment("33333333-3333-4333-8333-333333333333");
  const second = deployment("44444444-4444-4444-8444-444444444444");
  const unrelated = Array.from({ length: 24 }, (_, i) => deployment(
    `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`, "main",
  ));
  const p = new PagesProvider({
    accountId: "a".repeat(32), project: "twe-concierge", environment: "staging",
    branch: "develop", origin: "https://staging.travelwitheasegh.com", token: "synthetic",
  }, {
    fetcher: async url => ({
      ok: true,
      json: async () => ({ success: true, result: !url.includes("/deployments?")
        ? { production_branch: "main", name: "twe-concierge", subdomain: "twe-concierge.pages.dev" }
        : new URL(url).searchParams.get("page") === "1" ? [...unrelated, first] : [second] }),
    }),
  });
  const result = await p.findPublicationDeployment(job, async () => {}, {
    jobId: job.id, sourceSha: sha, digest: manifestDigest(job.manifest),
  });
  assert.equal(result, null);
});

test("reconciliation reports an older matching commit rejected by the time safeguard", async () => {
  const olderJob = { ...job, created_at: "2026-11-23T09:00:00Z" };
  const candidate = deployment("55555555-5555-4555-8555-555555555555");
  const reports = [];
  const result = await provider([candidate]).findPublicationDeployment(
    olderJob, async () => { throw new Error("Must not verify rejected candidate."); },
    { jobId: olderJob.id, sourceSha: sha, digest: manifestDigest(olderJob.manifest) },
    { info: meta => reports.push(meta) },
  );
  assert.equal(result, null);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reason, "no_match");
  assert.equal(reports[0].sourceMatches, 1);
  assert.equal(reports[0].rejectionReasons.beforeJob, 1);
  assert.equal(reports[0].candidates, 0);
});

test("reconciliation does not loop through pages repeatedly returning the same deployments", async () => {
  const row = deployment("66666666-6666-4666-8666-666666666666", "main");
  const entries = Array.from({ length: 25 }, (_, i) => ({
    ...row, id: `66666666-6666-4666-8666-${String(i).padStart(12, "0")}`,
  }));
  const requests = [], reports = [];
  const p = new PagesProvider({
    accountId: "a".repeat(32), project: "twe-concierge", environment: "staging",
    branch: "develop", origin: "https://staging.travelwitheasegh.com", token: "synthetic",
  }, {
    fetcher: async url => ({
      ok: true,
      json: async () => {
        if (!url.includes("/deployments?")) return { success: true, result: {
          name: "twe-concierge", production_branch: "main", subdomain: "twe-concierge.pages.dev",
        } };
        requests.push(url);
        return { success: true, result: entries };
      },
    }),
  });
  const result = await p.findPublicationDeployment(job, async () => {}, {
    jobId: job.id, sourceSha: sha, digest: manifestDigest(job.manifest),
  }, { info: meta => reports.push(meta) });
  assert.equal(result, null);
  assert.equal(requests.length, 2);
  assert.equal(reports[0].reason, "repeated_page");
  assert.equal(reports[0].repeatedPages, 1);
  assert.equal(reports[0].rejectionReasons.duplicate, 25);
});

test("Pages upload waits for terminal success before returning a deployment", async () => {
  const deploymentId = "11111111-1111-4111-8111-111111111111";
  let reads = 0, waited = 0, uploads = 0;
  const p = new PagesProvider({
    accountId: "a".repeat(32), project: "twe-concierge", environment: "staging",
    branch: "develop", origin: "https://staging.travelwitheasegh.com", token: "synthetic",
  }, {
    fetcher: async url => ({
      ok: true,
      json: async () => {
        if (!url.includes("?per_page=10")) return { success: true, result: {
          name: "twe-concierge", production_branch: "main", subdomain: "twe-concierge.pages.dev",
        } };
        reads++;
        return { success: true, result: [{
          ...deployment(deploymentId),
          latest_stage: { status: reads === 1 ? "active" : "success" },
        }] };
      },
    }),
    run: async () => { uploads++; },
    wait: async milliseconds => { assert.equal(milliseconds, 3000); waited++; },
  });
  const result = await p.deploy("/tmp/staged-build", { source_sha: sha, startedAt: "2026-11-23T08:01:00Z" });
  assert.equal(result.id, deploymentId);
  assert.equal(uploads, 1);
  assert.equal(reads, 2);
  assert.equal(waited, 1);
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
      assert.equal(typeof verify, "function");
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

test("continuous worker retries unverified recovery without starting a replacement release", async () => {
  const controller = new AbortController();
  const statuses = ["deploying", "verifying", "recovery_required", "recovery_required"];
  const calls = [], delays = [];
  const result = await runPublicationLoop({
    signal: controller.signal,
    runOnce: async () => {
      const status = statuses.shift();
      calls.push(status);
      if (calls.length === 4) controller.abort();
      return { id: "unverified-job", status };
    },
    sleep: async ms => { delays.push(ms); },
    intervalMs: 1000,
  });
  assert.deepEqual(calls, ["deploying", "verifying", "recovery_required", "recovery_required"]);
  assert.deepEqual(delays, [1000, 1000, 60000]);
  assert.deepEqual(result, { status: "stopped" });
});
