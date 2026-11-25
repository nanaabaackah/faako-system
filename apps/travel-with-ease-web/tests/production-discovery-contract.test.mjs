import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import approved from "../content/approved-public-release.json" with { type: "json" };
import { analyticsMeasurementId, TWE_MEASUREMENT_ID } from "../src/lib/analytics.js";

const source = (file) => readFileSync(new URL("../src/" + file, import.meta.url), "utf8");

test("production privacy and cookie notices reflect the approved enquiry-enabled release", () => {
  assert.ok(approved.pages.privacy?.entries?.length > 0);
  assert.ok(approved.pages.cookies?.entries?.length > 0);
  for (const page of ["contact", "terms", "services"]) {
    assert.ok(approved.pages[page], `${page} is included in the approved website release`);
  }
  assert.match(JSON.stringify(approved.pages.privacy), /The enquiry form collects/);
  assert.doesNotMatch(JSON.stringify(approved.pages.privacy), /currently uses contact by WhatsApp, email or telephone/);
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

import { pageDiscovery } from "../src/lib/discovery.js";

test("discovery graph describes published FAQs and services without invented offers", () => {
  const common = { origin: "https://travelwithease.example", title: "Travel With Ease", description: "Travel planning from Ghana" };
  const faq = pageDiscovery({ ...common, canonical: common.origin + "/faqs", pathname: "/faqs", content: { entries: [{ heading: "How do I enquire?", text: "**Send** an enquiry." }] } });
  const page = faq["@graph"].find(node => node["@type"] === "FAQPage");
  assert.equal(page.mainEntity[0].acceptedAnswer.text, "Send an enquiry.");
  const service = pageDiscovery({ ...common, canonical: common.origin + "/services/planning", pathname: "/services/planning", content: { title: "Planning", text: "Personalised travel planning" } });
  assert.ok(service["@graph"].some(node => node["@type"] === "Service"));
  assert.doesNotMatch(JSON.stringify(service), /aggregateRating|offers|priceCurrency/);
});
