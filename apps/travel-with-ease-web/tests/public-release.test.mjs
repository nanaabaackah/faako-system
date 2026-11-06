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

test("hosted builds use the approved release with privacy and cookies; local design preview remains separate", () => {
  assert.equal(publicationSnapshotPath({}), null);
  for (const PUBLIC_APP_ENV of ["production", "staging"]) {
    const home = JSON.parse(readPage({ PUBLIC_APP_ENV }));
    assert.equal(home.heading, "A little further. A little more you.");
    assert.equal(home.contactEmail, "");
    assert.doesNotMatch(JSON.stringify(home), /placeholder|awaiting approval|Design preview/i);
    for (const page of ["about", "services", "contact", "terms", "destinations"]) {
      assert.equal(JSON.parse(readPage({ PUBLIC_APP_ENV }, page)), null);
    }
    for (const page of ["privacy", "cookies"]) {
      const published = JSON.parse(readPage({ PUBLIC_APP_ENV }, page));
      assert.ok(published?.entries?.length, `${page} must contain an approved notice`);
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
  assert.match(home, /closing-scene__image[^>]*src="\/media\/b7e55[^"\s]+\.webp"/);
  assert.doesNotMatch(home, /business registration|BN\d{6,}|House no\s+\d|TWE\s+Concierge/i);
  assert.match(home, /name="robots" content="index, follow"/);
  assert.doesNotMatch(home, /Design preview|placeholder/i);
  const header = home.match(/<header[\s\S]*?<\/header>/)?.[0];
  assert.ok(header);
  assert.doesNotMatch(header, /href="\/(contact|terms|services|destinations)"/);
  assert.match(home, /Make room for(?:<br\s*\/?>|\s)+your next journey/);
  assert.match(home, /Online enquiry forms are not available yet/);
  assert.match(home, /Talk to us on WhatsApp/);
  assert.match(home, /closing-photos/);
  assert.match(home, /TWE_mockup[1-5][^"\s]*\.webp/);
  for (const slug of ["contact", "terms", "destinations"]) {
    const page = readFileSync(path.join(output, slug, "index.html"), "utf8");
    assert.match(page, /Content unavailable/);
    assert.match(page, /noindex, nofollow/);
    assert.doesNotMatch(page, /Placeholder for review/);
  }
  for (const slug of ["privacy", "cookies"]) {
    const page = readFileSync(path.join(output, slug, "index.html"), "utf8");
    assert.match(page, /name="robots" content="index, follow"/);
    assert.match(page, /rel="canonical"/);
    assert.doesNotMatch(page, /Content unavailable|Placeholder for review/);
  }
  assert.match(home, /data-measurement-id="G-GVJ2HGT6YN"/);
  assert.match(home, /data-cookie-analytics/);
  assert.match(home, /href="\/privacy"/);
  const robots = readFileSync(path.join(output, "robots.txt"), "utf8");
  assert.match(robots, /Sitemap: https:\/\/travelwitheasegh\.com\/sitemap-index\.xml/);
  assert.doesNotMatch(robots, /^Disallow: \/$/m);
  const sitemapIndex = readFileSync(path.join(output, "sitemap-index.xml"), "utf8");
  assert.match(sitemapIndex, /sitemap-0\.xml/);
  const sitemap = readFileSync(path.join(output, "sitemap-0.xml"), "utf8");
  for (const slug of ["privacy", "cookies"]) assert.match(sitemap, new RegExp("https://travelwitheasegh\\.com/" + slug + "(?:<|/)"));
  assert.doesNotMatch(sitemap, /\/(contact|terms|destinations)\/?</);
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
  assert.doesNotMatch(demo, /service-photography/);
  assert.match(demo, /\/media\/IMG_3328-1440\.webp/);
  assert.match(demo, /\/media\/12bacbf0[^"\s]+\.webp/);
  assert.match(demo, /closing-scene__image[^>]*src="\/media\/b7e55[^"\s]+\.webp"/);
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
