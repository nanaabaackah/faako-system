import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const astroSites = [
  ["apps/bynana-portfolio", "VITE"],
  ["apps/faako-website", "VITE"],
  ["apps/reebs-website", "VITE"],
  ["apps/ttngh", "PUBLIC"],
  ["apps/travel-with-ease-web", "PUBLIC"],
];

const read = (path) => readFile(new URL(path, root), "utf8");

test("public Astro sites expose consent-aware analytics and Search Console configuration", async () => {
  for (const [app, prefix] of astroSites) {
    const [layout, env, headers] = await Promise.all([
      read(`${app}/src/layouts/BaseLayout.astro`),
      read(`${app}/.env.example`),
      read(`${app}/public/_headers`),
    ]);

    assert.match(layout, /google-site-verification/, `${app} must render Search Console verification`);
    assert.match(env, new RegExp(`${prefix}_GOOGLE_SITE_VERIFICATION=`), `${app} must document verification configuration`);
    assert.match(headers, /www\.googletagmanager\.com/, `${app} CSP must allow the GA tag`);
    assert.match(headers, /google-analytics\.com/, `${app} CSP must allow GA collection`);
  }
});

test("the Stroane storefront configures Search Console without exposing it on the portal", async () => {
  const [config, env] = await Promise.all([
    read("apps/stroane-web/vite.config.ts"),
    read("apps/stroane-web/.env.example"),
  ]);

  assert.match(config, /buildSurface !== "portal"/);
  assert.match(config, /createGoogleSiteVerificationHtmlPlugin/);
  assert.match(env, /VITE_GOOGLE_SITE_VERIFICATION=/);
});
