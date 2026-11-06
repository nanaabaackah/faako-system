import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import approved from "../content/approved-public-release.json" with { type: "json" };
import { analyticsMeasurementId, TWE_MEASUREMENT_ID } from "../src/lib/analytics.js";

const source = (file) => readFileSync(new URL("../src/" + file, import.meta.url), "utf8");

test("production privacy and cookie notices are explicitly approved without promoting unapproved pages", () => {
  assert.ok(approved.pages.privacy?.entries?.length > 0);
  assert.ok(approved.pages.cookies?.entries?.length > 0);
  assert.equal(approved.pages.contact, null);
  assert.equal(approved.pages.terms, null);
  assert.equal(approved.pages.services, null);
  assert.match(JSON.stringify(approved.pages.privacy), /WhatsApp, email or telephone/);
  assert.doesNotMatch(JSON.stringify(approved.pages.privacy), /The enquiry form collects/);
});

test("production GA4 is gated by the published privacy notice and never defaults on staging", () => {
  assert.equal(analyticsMeasurementId({
    environment: "production",
    privacyAvailable: Boolean(approved.pages.privacy),
  }), TWE_MEASUREMENT_ID);
  assert.equal(analyticsMeasurementId({
    environment: "staging",
    privacyAvailable: Boolean(approved.pages.privacy),
  }), "");
  assert.equal(analyticsMeasurementId({
    environment: "production",
    privacyAvailable: false,
    configuredId: TWE_MEASUREMENT_ID,
  }), "");
});

test("consent preferences control analytics and Search Console verification remains optional", () => {
  const analytics = source("components/AnalyticsConsent.astro");
  const cookie = source("components/CookieNotice.astro");
  const layout = source("layouts/BaseLayout.astro");
  const config = readFileSync(new URL("../astro.config.mjs", import.meta.url), "utf8");
  const robots = source("pages/robots.txt.ts");

  assert.match(analytics, /initializeGoogleAnalytics/);
  assert.match(analytics, /savedConsent\.analytics/);
  assert.match(analytics, /twe:consent-changed/);
  assert.match(cookie, /data-cookie-analytics/);
  assert.match(cookie, /data-cookie-essential/);
  assert.match(cookie, /twe-cookie-consent-v1/);
  assert.match(layout, /PUBLIC_GOOGLE_SITE_VERIFICATION/);
  assert.match(config, /PUBLIC_SITE_INDEXABLE/);
  assert.match(config, /sitemap\(\{ filter:/);
  assert.match(robots, /sitemap-index\.xml/);
});
