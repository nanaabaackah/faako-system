import test from "node:test";
import assert from "node:assert/strict";
import { publishOne } from "../src/content/publication-worker.js";
import { PagesProvider, readPagesConfiguration } from "../src/content/pages-provider.js";

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
  await assert.rejects(publishOne(f.options), /approved release/); assert.deepEqual(f.events, []);
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
  const env = { APP_ENV: "staging", TWE_PUBLICATION_WORKER_ENABLED: "true", TWE_PUBLIC_SITE_ORIGIN: "https://staging.travelwitheasegh.com", TWE_PAGES_BRANCH: "develop", TWE_PAGES_ACCOUNT_ID: "a".repeat(32), TWE_PAGES_PROJECT: "twe-staging", TWE_PAGES_API_TOKEN: "test-only-not-a-credential", TWE_RELEASE_SHA: sha };
  assert.equal(readPagesConfiguration(env).branch, "develop");
  for (const changed of [{ APP_ENV: "development" }, { TWE_PAGES_BRANCH: "main" }, { TWE_PUBLIC_SITE_ORIGIN: "https://attacker.invalid" }, { TWE_PAGES_PROJECT: "../another" }, { TWE_PAGES_API_TOKEN: "" }, { TWE_RELEASE_SHA: "latest" }]) assert.throws(() => readPagesConfiguration({ ...env, ...changed }));
});
test("provider refuses a project with an unexpected production branch before upload", async () => {
  const provider = new PagesProvider({ accountId: "a".repeat(32), project: "twe-concierge", environment: "staging", branch: "develop", token: "test" }, { fetcher: async () => ({ ok: true, json: async () => ({ success: true, result: { production_branch: "unexpected" } }) }) });
  await assert.rejects(provider.previous(), /branch/);
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
test("staging without an accepted archived baseline cannot replace the current website", async () => {
  const f = fixture(); f.options.settings.environment = "staging";
  f.options.publication.claim = async () => ({ id: "job", source_sha: sha, environment: "staging", build_token: "lease", manifest: { pages: [] } });
  f.options.publication.lastLive = async () => null;
  assert.equal((await publishOne(f.options)).status, "failed");
  assert.equal(f.events.includes("deployed"), false);
});
