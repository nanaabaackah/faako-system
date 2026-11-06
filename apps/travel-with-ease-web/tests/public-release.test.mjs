import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { publicationSnapshotPath } from "../src/lib/published.js";

const readPage = (env, slug = "home") => execFileSync(process.execPath, ["--input-type=module", "-e", `import { publishedPage } from './src/lib/published.js'; console.log(JSON.stringify(publishedPage(${JSON.stringify(slug)})));`], {
  cwd: new URL("../", import.meta.url),
  env: { PATH: process.env.PATH, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
test("local and hosted builds use the same approved release", () => {
  assert.ok(publicationSnapshotPath({}) instanceof URL);
  for (const PUBLIC_APP_ENV of ["development", "production", "staging"]) {
    const home = JSON.parse(readPage({ PUBLIC_APP_ENV }));
    assert.equal(home.heading, "A little further. A little more you.");
    assert.equal(home.contactEmail, "");
    assert.doesNotMatch(JSON.stringify(home), /placeholder|awaiting approval|Design preview/i);
    for (const page of ["testimonials", "destinations"]) {
      assert.equal(JSON.parse(readPage({ PUBLIC_APP_ENV }, page)), null);
    }
    for (const page of ["about", "services", "terms", "packages", "contact", "privacy", "faqs", "cookies", "journal", "travel-tips"]) {
      assert.ok(JSON.parse(readPage({ PUBLIC_APP_ENV }, page)));
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
  assert.match(home, /BN045370826/);
  assert.match(home, /TWE Concierge/);
  assert.match(home, /96245096/);
  assert.doesNotMatch(home, /House no\s+\d/i);
  assert.match(home, /name="robots" content="index, follow"/);
  const visibleText = home.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(visibleText, /Design preview|placeholder/i);
  assert.doesNotMatch(home, /Demonstration travel tips|demo-checklist|demo-packing/);
  const header = home.match(/<header[\s\S]*?<\/header>/)?.[0];
  assert.ok(header);
  assert.doesNotMatch(header, /href="\/(contact|privacy|terms|destinations)"/);
  assert.match(header, /href="\/packages"/);
  assert.match(header, /href="\/services"/);
  assert.match(home, /Make room for(?:<br\s*\/?>|\s)+your next journey/);
  assert.doesNotMatch(home, /Online enquiry forms are not available yet|Enquiry availability/);
  assert.match(home, /public-enquiry-form/);
  assert.match(home, /Send enquiry/);
  assert.match(home, /closing-photos/);
  assert.match(home, /TWE_mockup[1-5][^"\s]*\.webp/);
  for (const slug of ["testimonials", "destinations"]) {
    const page = readFileSync(path.join(output, slug, "index.html"), "utf8");
    assert.match(page, slug === "destinations" ? /Our packages have a new home/ : /Content unavailable/);
    if (slug !== "destinations") assert.match(page, /noindex, nofollow/);
    assert.doesNotMatch(page, /Placeholder for review/);
  }
  const contact = readFileSync(path.join(output, "contact", "index.html"), "utf8");
  assert.match(contact, /public-enquiry-form/);
  assert.doesNotMatch(contact, /Content unavailable|Online enquiry forms are not available/);
  const sitemap = readFileSync(path.join(output, "sitemap-0.xml"), "utf8");
  assert.doesNotMatch(sitemap, /\/(testimonials|destinations)\/?</);
  assert.match(sitemap, /\/journal\/how-travel-with-ease-began/);
  assert.match(sitemap, /\/privacy</);
  assert.match(sitemap, /\/contact</);
  assert.match(sitemap, /\/packages\/zanzibar/);
});

test("staging ignores obsolete demo flags and builds only approved content", () => {
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
  assert.equal(existsSync(path.join(output, "demo")), false);
  const home = readFileSync(path.join(output, "index.html"), "utf8");
  assert.match(home, /A little further/);
  assert.doesNotMatch(home, /Sample journey · Zanzibar/);
  assert.match(readFileSync(path.join(output, "robots.txt"), "utf8"), /Disallow: \/$/m);
});
