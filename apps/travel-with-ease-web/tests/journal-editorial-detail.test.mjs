import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { journalBodyBlocks } from "../src/lib/journal-body.js";
import approved from "../content/approved-public-release.json" with { type: "json" };
const source = file => readFileSync(new URL("../src/" + file, import.meta.url), "utf8");

test("journal detail uses real editorial metadata and a two-column related-reading layout", () => {
  const article = source("components/JournalArticle.astro");
  const page = source("pages/journal/[slug].astro");
  const css = source("styles/components/journal-detail.css");
  assert.match(article, /class="editorial-wrap journal-detail journal-reading"/);
  assert.match(article, /journal-detail__grid/);
  assert.match(article, /<aside class="journal-detail__sidebar"/);
  assert.match(article, /article\.category|item\.category/);
  assert.match(article, /item\.author/);
  assert.match(article, /readingMinutes/);
  assert.match(article, /<time datetime=\{item.date\}>/);
  assert.match(article, /journal-detail__related-item/);
  assert.match(article, /journal-detail__more-grid/);
  assert.match(article, /<ContentLink button href="\/packages">Explore packages/);
  assert.match(css, /body main \.journal-detail \.journal-detail__planning h2 \{ color: var\(--brand-cream\); \}/);
  assert.match(article, /navigator\.share/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /journal-detail__more-card img[\s\S]*?height: clamp\(170px, 15vw, 220px\)/);
  assert.match(css, /journal-detail__more-card \.placed-image,[\s\S]*?journal-detail__more-card img \{ height: 110px; \}/);
  assert.match(page, /b\.date\.localeCompare\(a\.date\)/);
  for (const field of ["category", "author", "date", "image", "title", "slug"]) assert.ok(article.includes("item." + field));
});

test("journal story presentation does not invent views, saves, author portraits or a disconnected newsletter", () => {
  const article = source("components/JournalArticle.astro");
  const data = approved.pages.journal.articles;
  assert.ok(data.length >= 3);
  assert.ok(data.every(item => item.title && item.date && item.author && item.body));
  assert.doesNotMatch(article, /3\.4k|286 saves|view count|newsletter|Subscribe|authorAvatar|fakeViews/);
  for (const item of data) {
    const blocks = journalBodyBlocks(item.body);
    assert.ok(blocks.length >= 1);
  }
});

test("journal article typography is scoped to editorial detail, preserving existing TWE brand styles", () => {
  const typography = source("styles/typography.css");
  const layout = source("layouts/BaseLayout.astro");
  assert.match(typography, /--font-display: "Poiret One"/);
  assert.match(typography, /--font-body: "Quicksand"/);
  assert.doesNotMatch(layout, /family=Playfair\+Display/);
  assert.match(typography, /body \.journal-detail \.journal-detail__header h1 \{\s*font-family: var\(--font-display\)/);
  assert.match(typography, /body \.journal-detail \.journal-detail__content > p[\s\S]*?font-family: var\(--font-body\)/);
});
