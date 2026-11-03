import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

test("only snapshot Tips get stable Astro URLs, published relations and sitemap entries", () => {
  const directory = fileURLToPath(
    new URL("../node_modules/.cache/", import.meta.url),
  );
  mkdirSync(directory, { recursive: true });
  const output = mkdtempSync(path.join(directory, "twe-tips-"));
  const snapshot = path.join(output, "snapshot.json");
  const base = {
    heading: "Synthetic approved test",
    body: "",
    seoTitle: "Test",
    seoDescription: "Synthetic test only",
    entries: [],
    contactEmail: "",
    contactPhone: "",
    ctaLabel: "",
    ctaPath: "/#plan",
    image: null,
  };
  const tip = {
    slug: "fixture-tip",
    title: "Fixture tip",
    excerpt: "Test excerpt",
    body: "Literal <script>alert(1)</script> text",
    category: "Before You Go",
    featured: true,
    order: 0,
    relatedArticle: "missing-unpublished-story",
  };
  writeFileSync(
    snapshot,
    JSON.stringify({
      version: 1,
      pages: {
        home: base,
        contact: base,
        journal: { ...base, articles: [] },
        "travel-tips": { ...base, tips: [tip] },
      },
    }),
  );
  execFileSync("pnpm", ["run", "build"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      PUBLIC_APP_ENV: "production",
      PUBLIC_SITE_URL: "https://travelwitheasegh.com",
      PUBLIC_SITE_INDEXABLE: "true",
      TWE_CONTENT_SNAPSHOT: snapshot,
      TWE_BUILD_OUT_DIR: path.join(output, "dist"),
    },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120000,
  });
  const home = readFileSync(path.join(output, "dist/index.html"), "utf8");
  const listing = readFileSync(
    path.join(output, "dist/travel-tips/index.html"),
    "utf8",
  );
  const article = readFileSync(
    path.join(output, "dist/travel-tips/fixture-tip/index.html"),
    "utf8",
  );
  assert.match(home, /A little advice goes a long way/);
  assert.match(listing, /href="\/travel-tips\/fixture-tip"/);
  assert.match(article, /&lt;script&gt;/);
  assert.doesNotMatch(article, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(article, /href="\/journal\/missing-unpublished-story"/);
  assert.equal(
    existsSync(path.join(output, "dist/travel-tips/demo-checklist/index.html")),
    false,
  );
  const sitemap = readFileSync(path.join(output, "dist/sitemap-0.xml"), "utf8");
  assert.match(sitemap, /travel-tips\/fixture-tip/);
  assert.doesNotMatch(sitemap, /demo-checklist|missing-unpublished-story/);
});
