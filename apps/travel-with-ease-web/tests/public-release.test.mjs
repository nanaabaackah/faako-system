import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { publicationSnapshotPath } from "../src/lib/published.js";

const readPage = (env, slug = "home") => execFileSync(process.execPath, ["--input-type=module", "-e", `import { publishedPage } from './src/lib/published.js'; console.log(JSON.stringify(publishedPage(${JSON.stringify(slug)})));`], {
  cwd: new URL("../", import.meta.url),
  env: { PATH: process.env.PATH, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});

test("hosted builds use the approved release; local design preview remains separate", () => {
  assert.equal(publicationSnapshotPath({}), null);
  for (const PUBLIC_APP_ENV of ["production", "staging"]) {
    const home = JSON.parse(readPage({ PUBLIC_APP_ENV }));
    assert.equal(home.heading, "A little further. A little more you.");
    assert.equal(home.contactEmail, "");
    assert.doesNotMatch(JSON.stringify(home), /placeholder|awaiting approval|Design preview/i);
    for (const page of ["about", "services", "contact", "privacy", "terms", "destinations"]) {
      assert.equal(JSON.parse(readPage({ PUBLIC_APP_ENV }, page)), null);
    }
  }
});

test("an explicit missing CMS snapshot fails closed rather than republishing bundled content", () => {
  assert.equal(publicationSnapshotPath({ PUBLIC_APP_ENV: "production", TWE_CONTENT_SNAPSHOT: "/missing/reviewed.json" }), "/missing/reviewed.json");
  assert.throws(() => readPage({ PUBLIC_APP_ENV: "production", TWE_CONTENT_SNAPSHOT: "/missing/reviewed.json" }));
});

test("production build publishes approved content without preview copy or unpublished navigation", () => {
  // Astro renames prerender assets; output must share the checkout filesystem.
  const cache = fileURLToPath(new URL("../node_modules/.cache/", import.meta.url));
  mkdirSync(cache, { recursive: true });
  const output = mkdtempSync(path.join(cache, "twe-approved-build-"));
  execFileSync("pnpm", ["run", "build"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PUBLIC_APP_ENV: "production", PUBLIC_SITE_URL: "https://travelwitheasegh.com", PUBLIC_SITE_INDEXABLE: "true", TWE_CONTENT_SNAPSHOT: "", TWE_BUILD_OUT_DIR: output },
    stdio: ["ignore", "pipe", "pipe"], timeout: 120000,
  });
  const home = readFileSync(path.join(output, "index.html"), "utf8");
  assert.match(home, /A little further/);
  assert.doesNotMatch(home, /business registration|BN\d{6,}|House no\s+\d|TWE\s+Concierge/i);
  assert.match(home, /name="robots" content="index, follow"/);
  assert.doesNotMatch(home, /Design preview|placeholder/i);
  const header = home.match(/<header[\s\S]*?<\/header>/)?.[0];
  assert.ok(header);
  assert.doesNotMatch(header, /href="\/(contact|privacy|terms|services|destinations)"/);
  assert.match(home, /Make room for(?:<br\s*\/?>|\s)+your next journey/);
  assert.match(home, /Online enquiry forms are not available yet/);
  assert.match(home, /Talk to us on WhatsApp/);
  assert.match(home, /closing-photos/);
  assert.match(home, /TWE_mockup[1-5][^"\s]*\.webp/);
  for (const slug of ["contact", "privacy", "destinations"]) {
    const page = readFileSync(path.join(output, slug, "index.html"), "utf8");
    assert.match(page, /Content unavailable/);
    assert.match(page, /noindex, nofollow/);
    assert.doesNotMatch(page, /Placeholder for review/);
  }
  const sitemap = readFileSync(path.join(output, "sitemap-0.xml"), "utf8");
  assert.doesNotMatch(sitemap, /\/(contact|privacy|terms|destinations)\/?</);
});

test("staging demo builds an interactive noindex page while the approved homepage remains separate", () => {
  const cache = fileURLToPath(new URL("../node_modules/.cache/", import.meta.url));
  mkdirSync(cache, { recursive: true });
  const output = mkdtempSync(path.join(cache, "twe-staging-demo-build-"));
  execFileSync("pnpm", ["run", "build"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env, PUBLIC_APP_ENV: "staging",
      PUBLIC_SITE_URL: "https://staging.travelwitheasegh.com",
      PUBLIC_SITE_INDEXABLE: "false", PUBLIC_STAGING_DEMO_ENABLED: "true",
      PUBLIC_API_BASE_URL: "https://api-staging.travelwitheasegh.com",
      TWE_CONTENT_SNAPSHOT: "", TWE_BUILD_OUT_DIR: output,
    },
    stdio: ["ignore", "pipe", "pipe"], timeout: 120000,
  });
  const demo = readFileSync(path.join(output, "demo", "index.html"), "utf8");
  const home = readFileSync(path.join(output, "index.html"), "utf8");
  assert.match(demo, /Staging website demo/);
  assert.doesNotMatch(demo, /business registration|BN\d{6,}|House no\s+\d|TWE\s+Concierge/i);
  assert.match(demo, /Sample package enquiry|Sample personalised enquiry|sample enquiry/i);
  assert.match(demo, /staging test inbox/i);
  assert.match(demo, /noindex, nofollow/);
  assert.doesNotMatch(demo, /127\.0\.0\.1:5188|http-equiv="refresh"/);
  assert.match(home, /A little further/);
  assert.doesNotMatch(home, /Sample journey · Zanzibar/);
  assert.match(readFileSync(path.join(output, "robots.txt"), "utf8"), /Disallow: \/$/m);
});

test("staging demo refuses a missing API origin and production never enables the route", () => {
  const cache = fileURLToPath(new URL("../node_modules/.cache/", import.meta.url));
  mkdirSync(cache, { recursive: true });
  const output = mkdtempSync(path.join(cache, "twe-staging-no-api-"));
  assert.throws(() => execFileSync("pnpm", ["run", "build"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PUBLIC_APP_ENV: "staging", PUBLIC_SITE_URL: "https://staging.travelwitheasegh.com",
      PUBLIC_STAGING_DEMO_ENABLED: "true", PUBLIC_API_BASE_URL: "", TWE_CONTENT_SNAPSHOT: "", TWE_BUILD_OUT_DIR: output },
    stdio: ["ignore", "pipe", "pipe"], timeout: 120000,
  }));
});
