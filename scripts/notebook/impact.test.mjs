import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyChangedPaths, analyzeCommitRange } from "./impact.mjs";

test("maps app, shared package and isolated service changes", () => {
  const result = classifyChangedPaths([
    "apps/reebs-portal/src/App.jsx",
    "packages/ui/src/index.ts",
    "services/reebs-analytics/app/main.py",
  ]);
  assert.deepEqual(result.affectedComponents, [
    "apps/reebs-portal", "packages/ui", "services/reebs-analytics",
  ]);
  assert.equal(result.requiresManualReview, true);
  assert.equal(result.syncedToNotion, false);
  assert.equal(result.verified, false);
  assert.match(result.reviewReasons.join(" "), /dependent-app/);
});

test("maps nested TTNGH workspace without swallowing into top-level app", () => {
  const result = classifyChangedPaths(["apps/ttngh/studio/package.json", "services/ttngh-api/package.json"]);
  assert.deepEqual(result.affectedComponents, ["apps/ttngh/studio", "services/ttngh-api"]);
  assert.equal(result.requiresManualReview, false);
});

test("travel docs point to three separate apps", () => {
  const result = classifyChangedPaths(["docs/apps/travel-with-ease/architecture.md"]);
  assert.deepEqual(result.affectedComponents, [
    "apps/travel-with-ease-api", "apps/travel-with-ease-portal", "apps/travel-with-ease-web",
  ]);
});

test("global changes are marked for review, not automatically approved", () => {
  const result = classifyChangedPaths(["pnpm-lock.yaml", ".github/workflows/monorepo-ci.yml"]);
  assert.deepEqual(result.affectedComponents, ["faako-system"]);
  assert.equal(result.requiresManualReview, true);
});

test("deduplicates normalized filenames and sorts", () => {
  const result = classifyChangedPaths(["./apps/reebs-portal/README.md", "apps/reebs-portal/README.md"]);
  assert.equal(result.changedFiles.length, 1);
  assert.equal(result.affectedComponents.length, 1);
});

test("rejects traversal and absolute paths", () => {
  assert.throws(() => classifyChangedPaths(["../secret.txt"]), /Unsafe/);
  assert.throws(() => classifyChangedPaths(["/etc/passwd"]), /Unsafe/);
});

test("rejects invalid commit range refs before executing git", () => {
  assert.throws(() => analyzeCommitRange("main; rm -rf .", "develop"), /40-character/);
});

test("an empty diff has no affected components", () => {
  const result = classifyChangedPaths([]);
  assert.deepEqual(result.changedFiles, []);
  assert.deepEqual(result.affectedComponents, []);
  assert.equal(result.requiresManualReview, false);
});
