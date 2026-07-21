import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSiteStatus,
  buildSiteStatusFallback,
  getAggregateSiteStatus,
} from "./siteStatus.js";

test("buildSiteStatus preserves configured and unconfigured apps", async () => {
  const checkedUrls = [];
  const sites = [
    {
      id: "hosted",
      baseUrl: "https://example.com",
      pages: [{ label: "Home", path: "/" }, { label: "Health", path: "/health" }],
    },
    {
      id: "internal",
      baseUrl: "",
      pages: [{ label: "Home", path: "/" }],
    },
  ];

  const result = await buildSiteStatus({
    sites,
    concurrency: 2,
    checkUrlStatus: async (url) => {
      checkedUrls.push(url);
      return "online";
    },
  });

  assert.deepEqual(checkedUrls.sort(), [
    "https://example.com/",
    "https://example.com/health",
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].pages[0].status, "online");
  assert.equal(result[1].pages[0].status, "not_configured");
  assert.equal(result[1].pages[0].url, null);
});

test("buildSiteStatus preserves diagnostic evidence returned by a URL check", async () => {
  const result = await buildSiteStatus({
    sites: [
      {
        id: "api",
        baseUrl: "https://api.example.com",
        pages: [{ label: "Health", path: "/health" }],
      },
    ],
    checkUrlStatus: async () => ({
      status: "degraded",
      httpStatus: 401,
      responseTimeMs: 84,
      checkedAt: "2026-07-11T12:00:00.000Z",
      finalUrl: "https://api.example.com/health",
      method: "HEAD",
      errorType: "http_error",
    }),
  });

  assert.equal(result[0].pages[0].status, "degraded");
  assert.equal(result[0].pages[0].httpStatus, 401);
  assert.equal(result[0].pages[0].responseTimeMs, 84);
  assert.equal(result[0].pages[0].errorType, "http_error");
});

test("buildSiteStatusFallback keeps missing URLs explicitly not configured", () => {
  const result = buildSiteStatusFallback([
    { id: "hosted", baseUrl: "https://example.com", pages: [{ path: "/" }] },
    { id: "internal", baseUrl: "", pages: [{ path: "/" }] },
  ]);

  assert.equal(result[0].pages[0].status, "unknown");
  assert.equal(result[1].pages[0].status, "not_configured");
});

test("getAggregateSiteStatus distinguishes not configured apps", () => {
  assert.equal(getAggregateSiteStatus([{ status: "not_configured" }]), "not_configured");
  assert.equal(getAggregateSiteStatus([{ status: "online" }]), "online");
  assert.equal(
    getAggregateSiteStatus([{ status: "online" }, { status: "degraded" }]),
    "degraded"
  );
});
