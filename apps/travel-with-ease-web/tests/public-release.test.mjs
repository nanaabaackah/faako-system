import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  const output = mkdtempSync(path.join(tmpdir(), "twe-approved-build-"));
  execFileSync("pnpm", ["run", "build"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PUBLIC_APP_ENV: "production", PUBLIC_SITE_URL: "https://travelwitheasegh.com", PUBLIC_SITE_INDEXABLE: "true", TWE_CONTENT_SNAPSHOT: "", TWE_BUILD_OUT_DIR: output },
    stdio: ["ignore", "pipe", "pipe"], timeout: 120000,
  });
  const home = readFileSync(path.join(output, "index.html"), "utf8");
  assert.match(home, /A little further/);
  assert.match(home, /name="robots" content="index, follow"/);
  assert.doesNotMatch(home, /Design preview|placeholder|href="\/(contact|privacy|terms|services|destinations)"/i);
  for (const slug of ["contact", "privacy", "destinations"]) {
    const page = readFileSync(path.join(output, slug, "index.html"), "utf8");
    assert.match(page, /Content unavailable/);
    assert.match(page, /noindex, nofollow/);
    assert.doesNotMatch(page, /Placeholder for review/);
  }
  const sitemap = readFileSync(path.join(output, "sitemap-0.xml"), "utf8");
  assert.doesNotMatch(sitemap, /\/(contact|privacy|terms|destinations)\/?</);
});
