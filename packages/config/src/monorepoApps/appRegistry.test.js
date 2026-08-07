import assert from "node:assert/strict";
import test from "node:test";

import { getMonorepoAppByKey, getMonorepoMonitoringSites } from "./appRegistry.js";

const findSite = (sites, id) => sites.find((site) => site.id === id);
const pagePaths = (site) => new Set((site?.pages ?? []).map((page) => page.path));

test("TTNGH remains registered while its application workspace is deferred", () => {
  const ttngh = getMonorepoAppByKey("ttngh");

  assert.ok(ttngh, "expected TTNGH registry metadata");
  assert.equal(ttngh.workspaceRequired, false);
  assert.equal(ttngh.monitoringOptional, true);
});

test("monorepo monitoring keeps Dev ERP API checks in system status surfaces", () => {
  const sites = getMonorepoMonitoringSites({});
  const devErp = findSite(sites, "dev-erp");
  const devErpApi = findSite(sites, "dev-erp-api");

  assert.ok(devErp, "expected Dev ERP website monitoring surface");
  assert.ok(devErpApi, "expected Dev ERP API monitoring surface");
  assert.equal(devErp.category, "erp");
  assert.equal(devErpApi.category, "api");
  assert.equal(devErpApi.baseUrl, "https://api.dev.nanaabaackah.com");

  const websitePages = pagePaths(devErp);
  assert.ok(websitePages.has("/"));
  assert.ok(websitePages.has("/login"));
  assert.equal(websitePages.has("/health"), false);

  const apiPages = pagePaths(devErpApi);
  assert.ok(apiPages.has("/healthz"));
  assert.ok(apiPages.has("/api/public/trust-stats"));
});

test("monorepo monitoring includes Stroane storefront, portal, and backend surfaces", () => {
  const sites = getMonorepoMonitoringSites({});
  const stroaneWeb = findSite(sites, "stroane-web");
  const stroanePortal = findSite(sites, "stroane-portal");
  const stroaneApi = findSite(sites, "stroane-api");

  assert.ok(stroaneWeb, "expected Stroane public website monitoring surface");
  assert.ok(stroanePortal, "expected Stroane portal monitoring surface");
  assert.ok(stroaneApi, "expected Stroane API monitoring surface");
  assert.equal(stroanePortal.baseUrl, "https://portal.stroanesolutions.com");
  assert.equal(stroaneApi.baseUrl, "https://api.stroanesolutions.com");
  assert.equal(stroaneApi.configured, true);

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

  const apiPages = pagePaths(stroaneApi);
  assert.ok(apiPages.has("/health"));
  assert.ok(apiPages.has("/api/catalogue/products"));
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

test("monorepo monitoring keeps Faako API optional until an API host is configured", () => {
  const faakoApi = findSite(getMonorepoMonitoringSites({}), "faako-api");
  assert.ok(faakoApi, "expected Faako API monitoring surface");
  assert.equal(faakoApi.category, "api");
  assert.equal(faakoApi.baseUrl, "");
  assert.equal(faakoApi.configured, false);
  assert.ok(pagePaths(faakoApi).has("/health"));

  const configured = findSite(
    getMonorepoMonitoringSites({ FAAKO_API_BASE_URL: "https://api.faako.example.com" }),
    "faako-api"
  );
  assert.equal(configured.baseUrl, "https://api.faako.example.com");
  assert.equal(configured.configured, true);
});
