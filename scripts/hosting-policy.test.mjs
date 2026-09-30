import assert from "node:assert/strict";
import test from "node:test";
import { getCloudflareDeferral } from "./hosting-policy.mjs";
import { findWorkspaceRoot, getWorkspaceGraph } from "./workspace-graph.mjs";

test("only TTNGH's exact workspace is deferred from Cloudflare readiness", () => {
  const graph = getWorkspaceGraph(findWorkspaceRoot());
  const deferred = graph.apps.filter((app) => getCloudflareDeferral(app));
  assert.deepEqual(deferred.map((app) => app.name), ["@faako/ttngh"]);
  assert.match(getCloudflareDeferral(deferred[0]), /Cloudflare is not configured/);
});

test("unknown, renamed and other optional apps still require hosting checks", () => {
  for (const app of [
    { name: "@faako/reebs-portal", dir: "apps/reebs-portal" },
    { name: "@faako/reebs-website", dir: "apps/reebs-website" },
    { name: "@faako/new-site", dir: "apps/new-site", monitoringOptional: true },
    { name: "@faako/ttngh", dir: "apps/another-site" },
    { name: "@faako/another-site", dir: "apps/ttngh" },
  ]) assert.equal(getCloudflareDeferral(app), null);
});
