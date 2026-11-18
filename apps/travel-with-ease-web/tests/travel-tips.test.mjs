import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import approvedRelease from "../content/approved-public-release.json" with { type: "json" };
import { journalBodyBlocks } from "../src/lib/journal-body.js";

test("the client-approved snapshot has seven individual Journal tips and one Kenya story, not placeholders", () => {
  const posts = approvedRelease.pages.journal.articles;
  assert.equal(posts.length, 8);
  assert.equal(posts.filter(item => item.category === "Travel tip").length, 7);
  assert.equal(posts.filter(item => item.category === "Trip story").length, 1);
  assert.equal(posts.filter(item => item.series === "Before you fly").length, 5);
  assert.equal(posts.filter(item => item.series === "Visas and entry").length, 2);
  assert.deepEqual(posts.filter(item => item.homeTipOrder)
    .sort((a,b) => a.homeTipOrder - b.homeTipOrder)
    .map(item => item.title), [
      "6 documents every Ghanaian traveller needs",
      "Screenshot everything before you fly",
      "Always do this when you rent a car on holiday",
    ]);
  assert.match(posts.find(post => post.slug === "know-why-you-could-be-denied-boarding").body, /Last checked November 2026\./);
  assert.ok(posts.every(post => !JSON.stringify(post).includes("DM EASE")));
  assert.ok(posts.every(post => !JSON.stringify(post).includes("First-Time Traveller Checklist")));
  assert.deepEqual(approvedRelease.pages["travel-tips"].tips, []);
  assert.ok(posts.every(post => !post.image || post.image.src.startsWith("/media/")));
  assert.ok(posts.every(post => !post.ctaPath || post.ctaPath.startsWith("/")));
  assert.equal(posts.find(post => post.category === "Trip story").ctaPath, "/packages/nairobi");
  assert.equal(posts.filter(post => post.category === "Travel tip" && !post.series).length, 0);
  assert.equal(posts.some(post => /how-travel-with-ease-began|six-days-on-zanzibars-north-coast/.test(post.slug)), false);
});

test("plain-text Journal entries retain their wording while becoming accessible lists", () => {
  const post = approvedRelease.pages.journal.articles.find(item => item.slug === "six-documents-every-ghanaian-traveller-needs");
  const blocks = journalBodyBlocks(post.body);
  assert.equal(blocks.find(item => item.type === "ordered").items.length, 6);
  assert.equal(blocks.at(-1).type, "disclaimer");
  assert.match(blocks.at(-1).text, /Last checked October 2026/);
  const screenshots = approvedRelease.pages.journal.articles.find(item => item.slug === "screenshot-everything-before-you-fly");
  assert.equal(journalBodyBlocks(screenshots.body)[0].type, "unordered");
  assert.equal(journalBodyBlocks(screenshots.body)[0].items.length, 6);
});

test("prerendered Journal tips, homepage links and legacy redirects expose no other draft content", () => {
  const directory = fileURLToPath(new URL("../node_modules/.cache/", import.meta.url));
  mkdirSync(directory, { recursive: true });
  const output = mkdtempSync(path.join(directory, "twe-journal-tips-"));
  const snapshot = path.join(output, "snapshot.json");
  const base = {
    heading: "Synthetic approved test",
    body: "", seoTitle: "Test", seoDescription: "Synthetic only",
    entries: [], contactEmail: "", contactPhone: "", ctaLabel: "", ctaPath: "/#plan",
    image: null,
  };
  const tip = {
    slug: "fixture-tip",
    title: "Fixture tip",
    excerpt: "A one-line summary",
    body: "1. Literal <script>alert(1)</script> text\n\nEntry rules change. Confirm with the embassy or an official source before you travel. Last checked November 2026.",
    date: "2026-11-16",
    category: "Travel tip",
    series: "Before you fly",
    homeTipOrder: 1,
    ctaLabel: "Plan my trip",
    ctaPath: "/#plan",
    relatedArticleSlugs: ["missing-unpublished-story"],
  };
  writeFileSync(snapshot, JSON.stringify({version: 1, pages:{
    home:{...base,ctaLabel:"Fixture primary action",ctaPath:"/journal",editorialCopy:{tipsHeading:"Fixture practical advice",tipsCta:"Fixture all tips",closingHeading:"Fixture closing line",reviewsHeading:"Fixture reviews"},reviews:[{preview:"Fixture customer review",more:"Fixture full review"}]},
    contact:{...base,editorialCopy:{enquiryHeading:"Fixture enquiry heading",enquiryBody:"Fixture enquiry body"}},
    journal:{...base,heading:"Fixture journal heading",body:"Fixture journal introduction",articles:[tip]},
    "site-appearance":{...base,editorialCopy:{navCta:"Fixture navigation action",whatsappUrl:"https://wa.me/233200000000",companyDetails:"Fixture company details"}},
    "travel-tips":{...base,tips:[]},
  }}));
  execFileSync("pnpm", ["run", "build"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      PUBLIC_APP_ENV:"production", PUBLIC_SITE_URL:"https://travelwitheasegh.com",
      PUBLIC_SITE_INDEXABLE:"true", TWE_CONTENT_SNAPSHOT:snapshot,
      TWE_BUILD_OUT_DIR:path.join(output,"dist"),
    },
    stdio:["ignore","pipe","pipe"],timeout:120000,
  });
  const rendered=path.join(output,"dist");
  const home=readFileSync(path.join(rendered,"index.html"),"utf8");
  const listing=readFileSync(path.join(rendered,"journal/index.html"),"utf8");
  const article=readFileSync(path.join(rendered,"journal/fixture-tip/index.html"),"utf8");
  const old=readFileSync(path.join(rendered,"travel-tips/index.html"),"utf8");
  for (const copy of ["Fixture primary action","Fixture practical advice","Fixture all tips","Fixture closing line","Fixture reviews","Fixture customer review","Fixture enquiry heading","Fixture enquiry body","Fixture navigation action","Fixture company details","https://wa.me/233200000000"]) assert.ok(home.includes(copy), `Missing published editorial copy: ${copy}`);
  assert.match(listing,/Fixture journal heading/);
  assert.match(listing,/Fixture journal introduction/);
  assert.match(home,/href="\/journal\/fixture-tip"/);
  assert.match(home,/journal\?category=Travel%20tip/);
  assert.match(listing,/data-series="Before you fly"/);
  assert.match(article,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(article,/<script>alert\(1\)<\/script>/);
  assert.match(article,/Last checked November 2026/);
  assert.doesNotMatch(article,/href="\/journal\/missing-unpublished-story"/);
  assert.match(article,/href="\/#plan"/);
  assert.match(old,/journal\?category=Travel%20tip/);
  assert.equal(existsSync(path.join(rendered,"journal/missing-unpublished-story/index.html")),false);
  const sitemap=readFileSync(path.join(rendered,"sitemap-0.xml"),"utf8");
  assert.match(sitemap,/journal\/fixture-tip/);
  assert.doesNotMatch(sitemap,/demo-checklist|missing-unpublished-story/);
});
