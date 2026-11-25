import test from "node:test";
import assert from "node:assert/strict";
import { railwaySourceSha, requireRailwaySourceSha, assertPublicationSource, activeApiSourceMatches } from "../src/content/source-identity.js";

const sha = "a".repeat(40);
const other = "b".repeat(40);
const hosted = { APP_ENV: "staging", RAILWAY_GIT_COMMIT_SHA: sha, TWE_RELEASE_SHA: other };

test("Railway source identity is authoritative; legacy operator SHA cannot override it", () => {
  assert.equal(railwaySourceSha(hosted), sha);
  assert.equal(requireRailwaySourceSha(hosted), sha);
  assert.equal(railwaySourceSha({ TWE_RELEASE_SHA: sha }), undefined);
  for (const malformed of ["", "latest", "a".repeat(39), "A".repeat(40), "0".repeat(41)]) {
    assert.equal(railwaySourceSha({ RAILWAY_GIT_COMMIT_SHA: malformed }), undefined);
    assert.throws(() => requireRailwaySourceSha({ RAILWAY_GIT_COMMIT_SHA: malformed }));
  }
});

test("hosted publishing uses Git-linked Railway identity when runtime has no .git directory", async () => {
  let calls = 0;
  const run = async () => { calls++; throw new Error("Git is not bundled at runtime"); };
  assert.equal(await assertPublicationSource(sha, { env: hosted, gitMetadataPresent: false, run }), sha);
  assert.equal(calls, 0, "Host must not require Git metadata at runtime");
  await assert.rejects(assertPublicationSource(other, { env: hosted, gitMetadataPresent: false, run }), /does not match/);
  await assert.rejects(assertPublicationSource(sha, { env: { APP_ENV: "staging", TWE_RELEASE_SHA: sha }, gitMetadataPresent: false, run }), /Railway commit identity/);
  assert.equal(calls, 0, "Identity failure must occur before attempting to claim any job");
});

test("hosted Git checkout, when present, must agree with deployed SHA and have no dirty changes", async () => {
  const ok = async (_command, args) => args[0] === "rev-parse" ? sha : "";
  assert.equal(await assertPublicationSource(sha, { env: hosted, run: ok, gitMetadataPresent: true }), sha);
  await assert.rejects(assertPublicationSource(sha, {
    env: hosted, gitMetadataPresent: true, run: async (_cmd, args) => args[0] === "rev-parse" ? other : "",
  }), /Checkout does not match/);
  await assert.rejects(assertPublicationSource(sha, {
    env: hosted, gitMetadataPresent: true, run: async (_cmd, args) => args[0] === "rev-parse" ? sha : " M edited-file",
  }), /clean reviewed checkout/);
});

test("local publication retains reviewed Git proof rather than allowing manual source overrides", async () => {
  let calls = 0;
  const run = async (_command, args) => { calls++; return args[0] === "rev-parse" ? sha : ""; };
  assert.equal(await assertPublicationSource(sha, { env: { APP_ENV: "development" }, gitMetadataPresent: false, run }), sha);
  assert.equal(calls, 2);
});

test("active API release identity must match the exact source and environment", async () => {
  const settings = { apiOrigin: "https://api.example.invalid", environment: "production", sourceSha: sha };
  const response = (identity, ok = true) => async (url, options) => {
    assert.equal(url.href, "https://api.example.invalid/api/public/release");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    return { ok, json: async () => identity };
  };
  assert.equal(await activeApiSourceMatches(settings, response({ environment: "production", sourceSha: sha })), true);
  assert.equal(await activeApiSourceMatches(settings, response({ environment: "production", sourceSha: other })), false);
  assert.equal(await activeApiSourceMatches(settings, response({ environment: "staging", sourceSha: sha })), false);
  assert.equal(await activeApiSourceMatches(settings, response({}, false)), false);
  assert.equal(await activeApiSourceMatches(settings, async () => { throw Error("offline"); }), false);
  assert.equal(await activeApiSourceMatches({ ...settings, apiOrigin: "http://api.example.invalid" }, async () => assert.fail("must not fetch")), false);
});
