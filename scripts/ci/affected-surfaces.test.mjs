import assert from "node:assert/strict";
import test from "node:test";
import { getAffectedApps, getWorkspaceGraph, findWorkspaceRoot } from "../workspace-graph.mjs";
import { classifyImpact } from "./affected-surfaces.mjs";
import { getWatchPaths } from "./cloudflare-watch-paths.mjs";

const rootDir = findWorkspaceRoot();
const graph = getWorkspaceGraph(rootDir);
const impact = (...files) => {
  const affected = getAffectedApps({ rootDir, files });
  return classifyImpact({
    changedFiles: affected.changedFiles,
    affectedAppNames: affected.apps.map((app) => app.name),
    isGlobalChange: affected.isGlobalChange,
  });
};

test("a DEV ERP change does not launch unrelated app browser suites", () => {
  const result = impact("apps/dev-erp/src/pages/Dashboard/Dashboard.jsx");
  assert.equal(result.dev_erp, true);
  assert.equal(result.faako_public, false);
  assert.equal(result.reebs_public, false);
  assert.equal(result.reebs_water, false);
  assert.equal(result.twe, false);
  assert.deepEqual(result.affected_apps, ["@faako/dev-erp"]);
});

test("a TWE website change only selects TWE integration suite", () => {
  const result = impact("apps/travel-with-ease-web/src/pages/index.astro");
  assert.equal(result.twe, true);
  assert.equal(result.dev_erp, false);
  assert.equal(result.reebs_water, false);
});

test("a REEBS Portal edit triggers Water integration tests without treating every app as changed", () => {
  const result = impact("apps/reebs-portal/src/App.jsx");
  assert.equal(result.reebs_water, true);
  assert.equal(result.twe, false);
  assert.equal(result.dev_erp, false);
});

test("shared Faako UI changes select real dependents and not every workspace", () => {
  const result = impact("packages/ui/src/index.ts");
  assert.equal(result.dev_erp, true);
  assert.equal(result.twe, true);
  assert.equal(result.javascript, true);
});

test("an unrelated documentation-only edit does not trigger application checks", () => {
  const result = impact("docs/apps/dev-erp/README.md");
  assert.equal(result.javascript, false);
  assert.deepEqual(result.affected_apps, []);
});

test("global lockfile edits fail open to all affected workspaces", () => {
  const result = impact("pnpm-lock.yaml");
  assert.equal(result.global, true);
  assert.equal(result.dev_erp, true);
  assert.equal(result.twe, true);
  assert.equal(result.reebs_water, true);
});

test("root build scripts use conservative global checks", () => {
  const result = impact("scripts/vite/build.mjs");
  assert.equal(result.global, true);
  assert.equal(result.dev_erp, true);
});

test("Cloudflare watch paths include app dependencies and skip unrelated apps", () => {
  const paths = getWatchPaths(graph, "@faako/dev-erp");
  assert.ok(paths.include.includes("apps/dev-erp/*"));
  assert.ok(paths.include.includes("packages/ui/*"));
  assert.equal(paths.include.includes("apps/reebs-website/*"), false);
  assert.equal(paths.include.includes("packages/water-domain/*"), false);
  assert.ok(paths.include.includes("pnpm-lock.yaml"));
});

test("Cloudflare watch paths reject missing applications", () => {
  assert.throws(() => getWatchPaths(graph, "@faako/no-such-app"), /Unknown application/);
});
