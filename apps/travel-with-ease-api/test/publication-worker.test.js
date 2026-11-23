import test from "node:test";
import assert from "node:assert/strict";
import { publishOne } from "../src/content/publication-worker.js";
import { deploymentOriginForProject, PagesProvider, readPagesConfiguration } from "../src/content/pages-provider.js";

const sha = "a".repeat(40);
function fixture(overrides = {}) {
  const events = [], manifest = { version: 1, pages: [] };
  const options = {
    settings: { sourceSha: sha, environment: "production", origin: "https://travelwitheasegh.com", apiOrigin: "" },
    publication: {
      claim: async () => ({ id: "job", source_sha: sha, environment: "production", build_token: "lease", manifest }),
      transition: async (_id, _token, _from, to) => events.push(to),
      confirm: async () => events.push("confirmed"), fail: async () => events.push("failed"), confirmed: async () => null,
    },
    prepare: async () => ({ snapshot: "private-snapshot", publicDirectory: "private-public", marker: { jobId: "job", sourceSha: sha, digest: "digest" } }),
    run: async (command, args, env) => {
      if (command === "git") return args[0] === "rev-parse" ? sha : "";
      assert.equal(env.TWE_CONTENT_SNAPSHOT, "private-snapshot");
      assert.equal(env.TWE_PAGES_API_TOKEN, undefined); events.push("built"); return "";
    },
    provider: { previous: async () => ({ id: "previous" }), deploy: async () => { events.push("deployed"); return { id: "new", origin: "https://abc.twe.pages.dev" }; }, rollback: async () => events.push("rolled-back") },
    verify: async origin => events.push("verified:" + origin),
    ...overrides,
  };
  return { options, events };
}
test("worker builds pinned snapshot, deploys, verifies artifact and custom domain, then confirms live", async () => {
  const f = fixture(); const result = await publishOne(f.options);
  assert.equal(result.status, "live");
  assert.deepEqual(f.events, ["built", "deploying", "deployed", "verifying", "verified:https://abc.twe.pages.dev", "verified:https://travelwitheasegh.com", "confirmed"]);
});
test("unverified deployment rolls back before marking failed; build failure never deploys", async () => {
  const f = fixture({ verify: async () => { throw new Error("Marker mismatch"); } });
  assert.equal((await publishOne(f.options)).status, "failed");
  assert.deepEqual(f.events.slice(-2), ["rolled-back", "failed"]);
  const second = fixture(); second.options.prepare = async () => { throw new Error("Build failed"); };
  assert.equal((await publishOne(second.options)).status, "failed");
  assert.deepEqual(second.events, ["failed"]);
});
test("wrong checkout refuses before claiming; no background retry of unsafe provider deployment", async () => {
  const f = fixture({ run: async () => "different-source" });
  await assert.rejects(publishOne(f.options), /approved publication source/); assert.deepEqual(f.events, []);
  const second = fixture(); second.options.provider.deploy = async () => { throw new Error("Timeout after possible provider commit"); };
  assert.equal((await publishOne(second.options)).status, "deploying");
  assert.equal(second.events.includes("failed"), false); assert.equal(second.events.includes("rolled-back"), false);
});
test("lost database confirmation acknowledgement reconciles live without rolling back a committed publication", async () => {
  const f = fixture(); f.options.publication.confirm = async () => { throw new Error("Lost reply"); };
  f.options.publication.confirmed = async () => "new";
  assert.equal((await publishOne(f.options)).status, "live");
  assert.equal(f.events.includes("rolled-back"), false);
});
test("provider configuration pins environment, exact public origin, account, project, source and branch", () => {
  const env = { APP_ENV: "staging", TWE_PUBLICATION_WORKER_ENABLED: "true", TWE_PUBLIC_SITE_ORIGIN: "https://staging.travelwitheasegh.com", TWE_PAGES_BRANCH: "develop", TWE_PAGES_ACCOUNT_ID: "a".repeat(32), TWE_PAGES_PROJECT: "twe-staging", TWE_PAGES_API_TOKEN: "test-only-not-a-credential", RAILWAY_GIT_COMMIT_SHA: sha };
  assert.equal(readPagesConfiguration(env).branch, "develop");
  assert.equal(readPagesConfiguration(env).sourceSha, sha);
  assert.equal(readPagesConfiguration({ ...env, TWE_RELEASE_SHA: "b".repeat(40) }).sourceSha, sha);
  for (const changed of [{ APP_ENV: "development" }, { TWE_PAGES_BRANCH: "main" }, { TWE_PUBLIC_SITE_ORIGIN: "https://attacker.invalid" }, { TWE_PAGES_PROJECT: "../another" }, { TWE_PAGES_API_TOKEN: "" }, { RAILWAY_GIT_COMMIT_SHA: "" }, { RAILWAY_GIT_COMMIT_SHA: "latest" }]) assert.throws(() => readPagesConfiguration({ ...env, ...changed }));
});
test("provider refuses a project with an unexpected production branch before upload", async () => {
  const provider = new PagesProvider({ accountId: "a".repeat(32), project: "twe-concierge", environment: "staging", branch: "develop", token: "test" }, { fetcher: async () => ({ ok: true, json: async () => ({ success: true, result: { production_branch: "unexpected" } }) }) });
  await assert.rejects(provider.previous(), /branch/);
});
test("staging baseline lookup stays within the Pages deployment page-size limit", async () => {
  const requests = [];
  const provider = new PagesProvider(
    { accountId: "a".repeat(32), project: "twe-concierge", environment: "staging", branch: "develop", token: "test" },
    { fetcher: async url => {
      requests.push(url);
      return { ok: true, json: async () => ({ success: true, result: requests.length === 1
        ? { production_branch: "main" }
        : [{ id: "11111111-1111-4111-8111-111111111111", environment: "preview", latest_stage: { status: "success" }, deployment_trigger: { metadata: { branch: "develop" } } }] }) };
    } },
  );
  assert.equal((await provider.previous()).id, "11111111-1111-4111-8111-111111111111");
  assert.match(requests[1], /\/deployments\?per_page=25$/);
});
test("provider retries only safe transient reads and never retries mutations or permission failures", async () => {
  const settings = { accountId: "a".repeat(32), project: "twe-concierge", environment: "staging", branch: "develop", token: "test" };
  let reads = 0, waits = 0;
  const provider = new PagesProvider(settings, {
    fetcher: async () => {
      reads++;
      if (reads === 1) throw new DOMException("timed out", "TimeoutError");
      if (reads === 2) return { ok: false, status: 503, body: { cancel: async () => {} } };
      return { ok: true, json: async () => ({ success: true, result: { name: "twe-concierge" } }) };
    },
    wait: async () => { waits++; },
  });
  assert.equal((await provider.request()).name, "twe-concierge");
  assert.equal(reads, 3); assert.equal(waits, 2);

  let denied = 0;
  const permissionFailure = new PagesProvider(settings, { fetcher: async () => { denied++; return { ok: false, status: 403 }; }, wait: async () => {} });
  await assert.rejects(permissionFailure.request(), /request failed/);
  assert.equal(denied, 1);

  let mutations = 0;
  const mutationFailure = new PagesProvider(settings, { fetcher: async () => { mutations++; throw new DOMException("timed out", "TimeoutError"); }, wait: async () => {} });
  await assert.rejects(mutationFailure.request("/deployment/rollback", "POST"), /timed out/);
  assert.equal(mutations, 1);
});
test("provider validates deployments against the authoritative Pages subdomain after a project rename", () => {
  const project = { name: "twe-concierge", subdomain: "tee-concierge.pages.dev" };
  assert.equal(
    deploymentOriginForProject(
      { url: "https://abc123.tee-concierge.pages.dev" },
      project,
      "twe-concierge",
    ),
    "https://abc123.tee-concierge.pages.dev",
  );
  assert.throws(() => deploymentOriginForProject(
    { url: "https://abc123.attacker.pages.dev" },
    project,
    "twe-concierge",
  ), /deployment identity/);
  assert.throws(() => deploymentOriginForProject(
    { url: "https://abc123.tee-concierge.pages.dev" },
    { ...project, name: "another-project" },
    "twe-concierge",
  ), /project identity/);
});
test("shared-project staging restores the archived artifact on develop and never calls production rollback", async () => {
  const f = fixture();
  f.options.settings.environment = "staging";
  f.options.publication.claim = async () => ({ id: "job", source_sha: sha, environment: "staging", build_token: "lease", manifest: { pages: [] } });
  f.options.publication.lastLive = async () => ({ id: "previous-job", source_sha: sha, deployment_id: "previous", manifest: { pages: [] } });
  f.options.publication.recovered = async () => f.events.push("recovery-recorded");
  f.options.archive = { restore: async () => f.events.push("archive-restored"), retain: async () => f.events.push("archive-retained") };
  let deployments = 0, checks = 0;
  f.options.provider.deploy = async () => { deployments++; return { id: "new", origin: "https://preview.twe.pages.dev" }; };
  f.options.verify = async () => { checks++; if (checks === 1) throw new Error("Bad marker"); };
  assert.equal((await publishOne(f.options)).status, "failed");
  assert.equal(deployments, 2); assert.equal(checks, 3);
  assert.equal(f.events.includes("rolled-back"), false);
  assert.equal(f.events.includes("recovery-recorded"), true);
});
test("staging baseline mismatch logs an exact safe stage without deploying or changing the baseline", async () => {
  const diagnostics = [];
  const f = fixture({ logger: {
    warn: details => diagnostics.push(details),
    error: details => diagnostics.push(details),
  } });
  f.options.settings.environment = "staging";
  f.options.publication.claim = async () => ({
    id: "test-baseline-mismatch", source_sha: sha, environment: "staging",
    build_token: "lease", manifest: { pages: [] },
  });
  f.options.publication.lastLive = async () => ({
    id: "verified-old-release", source_sha: sha,
    deployment_id: "archived-preview", manifest: { pages: [] },
  });
  f.options.provider.previous = async () => ({ id: "newest-git-preview" });
  f.options.archive = { restore: async () => { throw Error("Should not restore."); } };
  assert.equal((await publishOne(f.options)).status, "failed");
  assert.deepEqual(diagnostics.map(x => [x.eventName, x.reason || x.stage]), [
    ["publication.baseline_rejected", "baseline_deployment_mismatch"],
    ["publication.release_stage_failed", "baseline_validation"],
  ]);
  assert.deepEqual(f.events, ["failed"]);
});

test("staging archive restoration failure is categorized without logging provider exception content", async () => {
  const diagnostics = [];
  const f = fixture({ logger: { error: data => diagnostics.push(data) } });
  f.options.settings.environment = "staging";
  f.options.publication.claim = async () => ({
    id: "test-archive-failure", source_sha: sha, environment: "staging",
    build_token: "lease", manifest: { pages: [] },
  });
  f.options.publication.lastLive = async () => ({
    id: "archived-release", source_sha: sha,
    deployment_id: "previous", manifest: { pages: [] },
  });
  f.options.archive = { restore: async () => { throw Error("DO_NOT_LOG_SECRET_VALUE"); } };
  assert.equal((await publishOne(f.options)).status, "failed");
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].stage, "archive_restore");
  assert.equal(diagnostics[0].deploymentStarted, false);
  assert.equal(JSON.stringify(diagnostics).includes("DO_NOT_LOG_SECRET_VALUE"), false);
  assert.deepEqual(f.events, ["failed"]);
});

test("website build failure is reported as its safe stage without starting another deployment", async () => {
  const diagnostics = [];
  const f = fixture({
    logger: { error: data => diagnostics.push(data) },
    run: async (command, args) => {
      if (command === "git") return args[0] === "rev-parse" ? sha : "";
      throw Error("DO_NOT_LOG_SECRET_BUILD_ERROR");
    },
  });
  assert.equal((await publishOne(f.options)).status, "failed");
  assert.equal(diagnostics[0].eventName, "publication.release_stage_failed");
  assert.equal(diagnostics[0].stage, "website_build");
  assert.equal(diagnostics[0].deploymentStarted, false);
  assert.equal(JSON.stringify(diagnostics).includes("DO_NOT_LOG_SECRET_BUILD_ERROR"), false);
  assert.deepEqual(f.events, ["failed"]);
});

test("staging without an accepted archived baseline cannot replace the current website", async () => {
  const f = fixture(); f.options.settings.environment = "staging";
  f.options.publication.claim = async () => ({ id: "job", source_sha: sha, environment: "staging", build_token: "lease", manifest: { pages: [] } });
  f.options.publication.lastLive = async () => null;
  assert.equal((await publishOne(f.options)).status, "failed");
  assert.equal(f.events.includes("deployed"), false);
});
