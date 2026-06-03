import assert from "node:assert/strict";
import test from "node:test";

import { getMonorepoMonitoringSites } from "./appRegistry.js";

const findSite = (sites, id) => sites.find((site) => site.id === id);
const pagePaths = (site) => new Set((site?.pages ?? []).map((page) => page.path));

test("monorepo monitoring includes Stroane storefront, portal, and backend surfaces", () => {
  const sites = getMonorepoMonitoringSites({});
  const stroaneWeb = findSite(sites, "stroane-web");
  const stroanePortal = findSite(sites, "stroane-portal");
  const stroaneApi = findSite(sites, "stroane-api");

  assert.ok(stroaneWeb, "expected Stroane public website monitoring surface");
  assert.ok(stroanePortal, "expected Stroane portal monitoring surface");
  assert.ok(stroaneApi, "expected Stroane API monitoring surface");
  assert.equal(stroanePortal.baseUrl, "https://portal.stroanesolutions.com");
  assert.equal(stroaneApi.baseUrl, "");
  assert.equal(stroaneApi.configured, false);

  const storefrontPages = pagePaths(stroaneWeb);
  assert.ok(storefrontPages.has("/catalogue"));
  assert.ok(storefrontPages.has("/products"));
  assert.ok(storefrontPages.has("/checkout"));
  assert.ok(storefrontPages.has("/signin"));
  assert.ok(storefrontPages.has("/signup"));

  const portalPages = pagePaths(stroanePortal);
  assert.ok(portalPages.has("/admin"));
  assert.ok(portalPages.has("/admin/inventory"));
  assert.ok(portalPages.has("/admin/products"));
  assert.ok(portalPages.has("/admin/reports"));
});

test("monorepo monitoring includes the full Faako marketing route surface", () => {
  const faako = findSite(getMonorepoMonitoringSites({}), "faako");
  assert.ok(faako, "expected Faako website monitoring surface");

  const paths = pagePaths(faako);
  assert.ok(paths.has("/solutions"));
  assert.ok(paths.has("/case-studies"));
  assert.ok(paths.has("/configure"));
  assert.ok(paths.has("/dashboard"));
  assert.ok(paths.has("/forgot-password"));
  assert.ok(paths.has("/privacy"));
  assert.ok(paths.has("/terms"));
});
