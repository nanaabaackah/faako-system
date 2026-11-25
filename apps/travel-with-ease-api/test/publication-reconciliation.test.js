import { writeFile } from "node:fs/promises";
import path from "node:path";
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

test("reconciliation verifies an exact matching Pages artifact even when it predates the CMS job record", async () => {
  const laterJob = { ...job, created_at: "2026-11-23T09:00:00Z" };
  const candidate = deployment("55555555-5555-4555-8555-555555555555");
  const marker = { jobId: laterJob.id, sourceSha: sha, digest: manifestDigest(laterJob.manifest) };
  const visited = [], reports = [];
  const found = await provider([candidate]).findPublicationDeployment(
    laterJob,
    async (origin, proof) => {
      assert.deepEqual(proof, marker);
      visited.push(origin);
    },
    marker, { info: meta => reports.push(meta) },
  );
  assert.equal(found.id, candidate.id);
  assert.deepEqual(visited, [candidate.url, "https://staging.travelwitheasegh.com"]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].reason, "candidate_found");
  assert.equal(reports[0].olderThanJob, 1);
  assert.equal(reports[0].sourceMatches, 1);
  assert.equal(reports[0].candidates, 1);
  assert.equal(reports[0].verified, 1);
});

test("reconciliation still refuses a preexisting Pages artifact without the exact immutable marker", async () => {
  const laterJob = { ...job, created_at: "2026-11-23T09:00:00Z" };
  const candidate = deployment("55555555-5555-4555-8555-555555555555");
  const reports = [];
  let customOriginChecked = false;
  const found = await provider([candidate]).findPublicationDeployment(
    laterJob,
    async origin => {
      if (origin === "https://staging.travelwitheasegh.com")
        customOriginChecked = true;
      else
        throw new Error("Deployed marker does not match this publication.");
    },
    { jobId: laterJob.id, sourceSha: sha, digest: manifestDigest(laterJob.manifest) },
    { info: meta => reports.push(meta) },
  );
  assert.equal(found, null);
  assert.equal(customOriginChecked, false);
  assert.equal(reports[0].olderThanJob, 1);
  assert.equal(reports[0].rejectionReasons.markerMismatch, 1);
  assert.equal(reports[0].verified, 0);
});

test("reconciliation still refuses an older artifact when the staging origin marker differs", async () => {
  const laterJob = { ...job, created_at: "2026-11-23T09:00:00Z" };
  const candidate = deployment("55555555-5555-4555-8555-555555555555");
  const marker = { jobId: laterJob.id, sourceSha: sha, digest: manifestDigest(laterJob.manifest) };
  await assert.rejects(
    provider([candidate]).findPublicationDeployment(
      laterJob,
      async origin => {
        if (origin === "https://staging.travelwitheasegh.com")
          throw new Error("Custom origin does not match publication.");
      },
      marker,
    ),
    /Custom origin does not match publication/,
  );
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

test("one-shot staging replay restores the exact archived CMS artifact and confirms only after origin verification", async () => {
  const stalled = { ...job, status: "verifying", recovery_deployment_id: null };
  const marker = { jobId: stalled.id, sourceSha: sha, digest: manifestDigest(stalled.manifest) };
  const baseline = { id: "bbbbbbbb-1111-4111-8111-111111111111",
    source_sha: "b".repeat(40), deployment_id: "cccccccc-1111-4111-8111-111111111111",
    manifest: { version: 1, pages: [] } };
  const oldMarker = { jobId: baseline.id, sourceSha: baseline.source_sha,
    digest: manifestDigest(baseline.manifest) };
  const calls = [], verified = [];
  const result = await reconcileStalePublication({
    publication: {
      staleDeployment: async () => stalled,
      lastLive: async () => baseline,
      claimStagingReplay: async (id, token) => {
        calls.push("claim"); assert.equal(id, stalled.id); assert.equal(token, stalled.build_token);
        return true;
      },
      recordStagingReplay: async (id, token, deployedId) => {
        assert.equal(id, stalled.id); assert.equal(deployedId, "dddddddd-1111-4111-8111-111111111111");
        calls.push("record");
      },
      confirmReconciled: async (id, token, deployedId, digest) => {
        assert.equal(id, stalled.id); assert.equal(deployedId, "dddddddd-1111-4111-8111-111111111111");
        assert.equal(digest, marker.digest); calls.push("confirm");
      },
      confirmed: async () => null,
    },
    provider: {
      findPublicationDeployment: async (_job, _verify, _marker, _logger, options) => {
        assert.equal(options.allowCurrentMismatch, true);
        return { id: "original", currentMatches: false };
      },
      verifiedStagingBaseline: async (row, _verify, proof) => {
        assert.equal(row, baseline); assert.deepEqual(proof, oldMarker); calls.push("baseline");
      },
      deploy: async (_dir, args) => {
        assert.equal(args.source_sha, stalled.source_sha);
        calls.push("upload");
        return { id: "dddddddd-1111-4111-8111-111111111111",
          origin: "https://fresh.tee-concierge.pages.dev" };
      },
    },
    archive: {
      restore: async (_id, directory) => {
        calls.push("restore");
        await writeFile(path.join(directory, "twe-publication.json"), JSON.stringify(marker));
      },
    },
    settings: { environment: "staging", origin: "https://staging.travelwitheasegh.com" },
    verify: async (origin, proof) => {
      verified.push(origin);
      assert.deepEqual(proof, origin === "https://fresh.tee-concierge.pages.dev" ? marker :
        calls.includes("upload") ? marker : oldMarker);
    },
    originAttempts: 1,
  });
  assert.equal(result.status, "live");
  assert.deepEqual(calls, ["baseline", "restore", "claim", "upload", "record", "confirm"]);
  assert.deepEqual(verified, [
    "https://staging.travelwitheasegh.com",
    "https://fresh.tee-concierge.pages.dev",
    "https://staging.travelwitheasegh.com",
  ]);
});

test("stale staging replay never reuploads after durable claim or for an unverified archive", async () => {
  const stalled = { ...job, status: "verifying" };
  const marker = { jobId: job.id, sourceSha: sha, digest: manifestDigest(job.manifest) };
  const make = (claim, archived = marker) => {
    let uploads = 0, claims = 0;
    const options = {
      publication: {
        staleDeployment: async () => stalled,
        lastLive: async () => ({ id: "prior", source_sha: sha, manifest: { pages: [] } }),
        claimStagingReplay: async () => { claims++; return claim; },
        confirmed: async () => null,
      },
      provider: {
        findPublicationDeployment: async () => ({ id: "original", currentMatches: false }),
        verifiedStagingBaseline: async () => {},
        deploy: async () => { uploads++; throw new Error("Upload must not be reached."); },
      },
      archive: {
        restore: async (_id, directory) => {
          await writeFile(path.join(directory, "twe-publication.json"), JSON.stringify(archived));
        },
      },
      settings: { environment: "staging", origin: "https://staging.travelwitheasegh.com" },
      verify: async () => {},
    };
    return { options, counts: () => ({ uploads, claims }) };
  };
  const alreadyClaimed = make(false);
  assert.equal((await reconcileStalePublication(alreadyClaimed.options)).status, "recovery_required");
  assert.deepEqual(alreadyClaimed.counts(), { uploads: 0, claims: 1 });
  const badArchive = make(true, { ...marker, digest: "not-the-archived-release" });
  assert.equal((await reconcileStalePublication(badArchive.options)).status, "recovery_required");
  assert.deepEqual(badArchive.counts(), { uploads: 0, claims: 0 });
});

test("staging reconciliation verifies a recorded replay without another Pages scan or upload", async () => {
  const replay = { ...job, status: "verifying",
    recovery_deployment_id: "aaaaaaaa-1111-4111-8111-111111111111" };
  let confirmed = 0;
  const result = await reconcileStalePublication({
    publication: {
      staleDeployment: async () => replay,
      confirmReconciled: async (_id, _lease, id) => {
        assert.equal(id, replay.recovery_deployment_id); confirmed++;
      },
      confirmed: async () => null,
    },
    provider: {
      findPublicationDeployment: async () => { throw Error("Must not scan Pages list."); },
      verifyRecordedReplay: async (_job, _verify, marker) => {
        assert.equal(marker.jobId, replay.id);
        return { id: replay.recovery_deployment_id };
      },
    },
  });
  assert.equal(result.status, "live");
  assert.equal(confirmed, 1);
});

test("staging replay claim uses existing database lease and permits only one upload", async () => {
  const queries = [];
  const repository = new PublicationRepository({
    query: async (sql, params) => {
      queries.push({ sql, params }); return { rowCount: queries.length === 1 ? 1 : 0 };
    },
  }, { organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    environment: "staging", sourceSha: sha });
  assert.equal(await repository.claimStagingReplay(job.id, job.build_token), true);
  assert.equal(await repository.claimStagingReplay(job.id, job.build_token), false);
  assert.match(queries[0].sql, /status = 'verifying'/);
  assert.match(queries[0].sql, /last_error IS DISTINCT FROM 'staging_replay_claimed'/);
  assert.doesNotMatch(queries[0].sql, /updated_at\s*=/);
});

const terminalJob = { ...job, updated_at: "2026-11-23T08:01:00Z", manifest: { ...job.manifest, triggerType: "code_release" } };
const directTerminal = {
  ...deployment("11111111-1111-4111-8111-111111111111"),
  latest_stage: { status: "skipped", ended_on: "2026-11-23T08:03:00Z" },
  is_skipped: true,
  deployment_trigger: { type: "ad_hoc", metadata: { branch: "develop", commit_hash: sha, commit_message: "" } },
};
function terminalProvider(rows, detail = directTerminal, environment = "staging") {
  const p = provider([]);
  p.settings.environment = environment;
  p.request = async suffix => {
    if (!suffix) return { name: "twe-concierge", production_branch: "main", subdomain: "twe-concierge.pages.dev" };
    if (suffix.startsWith("/deployments?")) return rows;
    assert.equal(suffix, "/deployments/" + detail.id);
    return detail;
  };
  return p;
}
test("terminal staging recovery requires a unique completed direct upload, never a skipped Git build", async () => {
  const git = { ...directTerminal, id: "22222222-2222-4222-8222-222222222222", deployment_trigger: { ...directTerminal.deployment_trigger, type: "github:push" } };
  assert.deepEqual(await terminalProvider([git, directTerminal]).terminalStagingDeployment(terminalJob), { id: directTerminal.id, status: "skipped" });
  assert.equal(await terminalProvider([git]).terminalStagingDeployment(terminalJob), null);
  assert.equal(await terminalProvider([]).terminalStagingDeployment(terminalJob), null);
  const other = { ...directTerminal, id: "33333333-3333-4333-8333-333333333333" };
  assert.equal(await terminalProvider([directTerminal, other]).terminalStagingDeployment(terminalJob), null);
  assert.equal(await terminalProvider([directTerminal], { ...directTerminal, latest_stage: { status: "active" } }).terminalStagingDeployment(terminalJob), null);
  assert.equal(await terminalProvider([directTerminal], directTerminal, "production").terminalStagingDeployment(terminalJob), null);
  assert.equal(await terminalProvider([directTerminal]).terminalStagingDeployment({ ...terminalJob, status: "verifying" }), null);
  assert.equal(await terminalProvider([directTerminal]).terminalStagingDeployment({ ...terminalJob, updated_at: "2026-11-23T08:04:00Z" }), null);
  const wrongTag = { ...directTerminal, deployment_trigger: { type: "ad_hoc", metadata: { ...directTerminal.deployment_trigger.metadata, commit_message: "TWE publication another-job" } } };
  assert.equal(await terminalProvider([wrongTag], wrongTag).terminalStagingDeployment(terminalJob), null);
  assert.equal(await terminalProvider([directTerminal]).terminalStagingDeployment({ ...terminalJob, manifest: { ...terminalJob.manifest, triggerType: "cms_publication" } }), null);
});
test("terminal recovery preserves verified website and refuses missing or changed evidence", async () => {
  const baseline = { id: "bbbbbbbb-1111-4111-8111-111111111111", source_sha: "b".repeat(40), manifest: { pages: [] } };
  let closed = 0, baselineVerified = 0;
  const options = {
    settings: { environment: "staging" },
    publication: {
      staleDeployment: async () => terminalJob,
      lastLive: async () => baseline,
      confirmed: async () => null,
      failTerminalStagingDeployment: async (row, proof, baselineId) => {
        assert.equal(row.id, terminalJob.id);
        assert.equal(proof.id, directTerminal.id);
        assert.equal(baselineId, baseline.id);
        closed++;
        return true;
      },
    },
    provider: {
      findPublicationDeployment: async () => null,
      terminalStagingDeployment: async () => ({ id: directTerminal.id, status: "skipped" }),
      verifiedStagingBaseline: async (_baseline, _verify, marker) => {
        assert.equal(marker.digest, manifestDigest(baseline.manifest));
        baselineVerified++;
      },
    },
  };
  assert.equal((await reconcileStalePublication(options)).status, "failed");
  assert.equal(closed, 1);
  assert.equal(baselineVerified, 1);
  options.provider.verifiedStagingBaseline = async () => { throw new Error("Marker changed."); };
  assert.equal((await reconcileStalePublication(options)).status, "recovery_required");
  assert.equal(closed, 1);
  options.provider.terminalStagingDeployment = async () => null;
  assert.equal((await reconcileStalePublication(options)).status, "recovery_required");
  assert.equal(closed, 1);
});
test("terminal failure preserves content pointers and requires stale lease and current baseline", async () => {
  const queries = [];
  const baselineId = "bbbbbbbb-1111-4111-8111-111111111111";
  const repository = new PublicationRepository({ connect: async () => ({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes("status='live'")) return { rows: [{ id: baselineId }] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  }) }, { organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", environment: "staging", sourceSha: sha });
  assert.equal(await repository.failTerminalStagingDeployment(terminalJob, { id: directTerminal.id, status: "skipped" }, baselineId), true);
  assert.equal(queries.some(q => q.sql.includes("UPDATE twe.content_items")), false);
  const update = queries.find(q => q.sql.includes("provider_terminal_failure"));
  assert.match(update.sql, /build_token=\$4 AND status='deploying'/);
  assert.match(update.sql, /updated_at=\$6/);
  assert.equal(update.params[4], directTerminal.id);
  assert.ok(queries.some(q => q.sql.includes("INSERT INTO twe.audit_records") && q.params.includes("content.deployment_terminal_failure")));
  assert.equal(queries.at(-1).sql, "COMMIT");
});
