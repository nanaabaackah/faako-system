import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const astroSites = [
  ["apps/bynana-portfolio", "VITE", "src/App.jsx", "src/components/CookieConsentBanner.jsx"],
  ["apps/faako-website", "VITE", "src/components/islands/AnalyticsIsland.jsx", "src/components/CookieConsentBanner.jsx"],
  ["apps/reebs-website", "VITE", "src/utils/analytics.js", "src/components/CookieBanner/CookieBanner.jsx"],
  ["apps/ttngh", "PUBLIC", "src/components/AnalyticsConsent.astro", "src/components/CookieNotice.astro"],
  ["apps/travel-with-ease-web", "PUBLIC", "src/components/AnalyticsConsent.astro", "src/components/CookieNotice.astro"],
];

const read = (path) => readFile(new URL(path, root), "utf8");

test("public Astro sites expose consent-aware analytics and Search Console configuration", async () => {
  for (const [app, prefix, analyticsPath, consentPath] of astroSites) {
    const [layout, env, headers, analytics, consent] = await Promise.all([
      read(`${app}/src/layouts/BaseLayout.astro`),
      read(`${app}/.env.example`),
      read(`${app}/public/_headers`),
      read(`${app}/${analyticsPath}`),
      read(`${app}/${consentPath}`),
    ]);

    assert.match(layout, /google-site-verification/, `${app} must render Search Console verification`);
    assert.match(env, new RegExp(`${prefix}_GA_MEASUREMENT_ID=`), `${app} must document its own GA4 stream`);
    assert.match(env, new RegExp(`${prefix}_GOOGLE_SITE_VERIFICATION=`), `${app} must document verification configuration`);
    assert.match(analytics, /GoogleAnalytics|googleAnalytics/, `${app} must use the shared analytics implementation`);
    assert.match(consent, /analytics/, `${app} must expose an analytics consent choice`);
    assert.match(headers, /www\.googletagmanager\.com/, `${app} CSP must allow the GA tag`);
    assert.match(headers, /google-analytics\.com/, `${app} CSP must allow GA collection`);
  }
});

test("the Stroane storefront configures Search Console without exposing it on the portal", async () => {
  const [config, env, runtime, consent] = await Promise.all([
    read("apps/stroane-web/vite.config.ts"),
    read("apps/stroane-web/.env.example"),
    read("apps/stroane-web/src/frontend/main.tsx"),
    read("apps/stroane-web/src/frontend/components/CookieConsentBanner.tsx"),
  ]);

  assert.match(config, /buildSurface !== "portal"/);
  assert.match(config, /createGoogleSiteVerificationHtmlPlugin/);
  assert.match(env, /VITE_GA_MEASUREMENT_ID=/);
  assert.match(env, /VITE_GOOGLE_SITE_VERIFICATION=/);
  assert.match(runtime, /GoogleAnalyticsRouteTracker/);
  assert.match(runtime, /consent=\{analyticsConsent\}/);
  assert.match(consent, /analytics/);
});
