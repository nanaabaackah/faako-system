import test from "node:test";
import assert from "node:assert/strict";
import {
  contentBodySchema,
  contentForPage,
  footprintCountryCodes,
  pageSchema,
  pageNames,
  contentMediaIds,
  saveContentSchema,
} from "../src/content/schema.js";
import { readFileSync } from "node:fs";
import { createApp } from "../src/app.js";
import { isAllowedPortalApiRoute } from "../src/portal/proxy.js";

test("all code-owned CMS sections are allowed through protected portal routing", () => {
  for (const page of pageNames) {
    assert.equal(isAllowedPortalApiRoute("GET", `/api/agent/content/${page}`), true);
    assert.equal(isAllowedPortalApiRoute("POST", `/api/agent/content/${page}/draft`), true);
  }
  assert.equal(isAllowedPortalApiRoute("POST", "/api/agent/content/../../private/draft"), false);
});

test("Travel Tips are bounded, page-specific records with unique stable URLs", () => {
  const base = { heading: "Tips", body: "", seoTitle: "Tips", seoDescription: "Approved advice" };
  const tip = { slug: "packing", title: "Packing", excerpt: "Summary", body: "Body", category: "Packing Smart" };
  const parsed = contentForPage("travel-tips", { ...base, tips: [tip] });
  assert.equal(parsed.tips[0].featured, false);
  assert.equal(parsed.tips[0].order, 0);
  assert.equal(parsed.tips[0].imageId, null);
  assert.throws(() => contentForPage("home", { ...base, tips: [tip] }));
  assert.throws(() => contentForPage("travel-tips", { ...base, tips: [tip, tip] }));
  for (const invalid of [{ slug: "../private" }, { category: "Unsafe category" }, { order: -1 }, { order: 1.5 }, { imageId: "remote-url" }, { relatedArticle: "javascript:alert(1)" }, { featured: "true" }]) {
    assert.throws(() => contentForPage("travel-tips", { ...base, tips: [{ ...tip, ...invalid }] }));
  }
});

test("packages and enhanced Journal retain strict validation and all nested media references", () => {
  const base = { heading: "Fixture", body: "", seoTitle: "Fixture", seoDescription: "Synthetic only" };
  const imageId = "40000000-0000-4000-8000-000000000001";
  const galleryId = "40000000-0000-4000-8000-000000000002";
  const pkg = { id: "30000000-0000-4000-8000-000000000001", slug: "fixture-journey", title: "Fixture", destination: "Synthetic", overview: "Not an offer", imageId, galleryImageIds: [galleryId], itinerary: [{ day: 1, title: "Test day", text: "Test" }] };
  const parsed = contentForPage("packages", { ...base, packages: [pkg] });
  assert.deepEqual(contentMediaIds(parsed).sort(), [imageId, galleryId].sort());
  assert.throws(() => contentForPage("home", { ...base, packages: [pkg] }));
  assert.throws(() => contentForPage("packages", { ...base, packages: [pkg, pkg] }));
  for (const invalid of [{ slug: "../private" }, { id: "not-uuid" }, { availability: "booked" }, { galleryImageIds: ["https://evil.invalid/x"] }, { itinerary: [{ day: -1, title: "X", text: "Y" }] }, { itinerary: [pkg.itinerary[0], pkg.itinerary[0]] }, { relatedArticles: ["javascript:alert(1)"] }]) {
    assert.throws(() => contentForPage("packages", { ...base, packages: [{ ...pkg, ...invalid }] }));
  }
  const article = { slug: "fixture-story", title: "Story", excerpt: "Synthetic", body: "Test", date: "2026-11-01", imageId, galleryImageIds: [galleryId], category: "Travel guides" };
  assert.deepEqual(contentMediaIds(contentForPage("journal", { ...base, articles: [article] })).sort(), [imageId, galleryId].sort());
});

test("image placements accept only reviewed slots, bounded crops and internal media references",()=>{
  const base={heading:'Image fixture',body:'',seoTitle:'Fixture',seoDescription:'Test only'};
  const imageId='40000000-0000-4000-8000-000000000001',mobileImageId='40000000-0000-4000-8000-000000000002';
  const result=contentForPage('home',{...base,imagePlacements:{hero:{imageId,mobileImageId,focalY:15}}});
  assert.deepEqual(contentMediaIds(result),[imageId,mobileImageId]);
  assert.equal(result.imagePlacements.hero.focalY,15);
  for(const placement of [{focalX:-1},{mobileFocalY:101},{imageId:'https://untrusted.invalid/photo'},{css:'position:fixed'},{layout:'left'}])
    assert.throws(()=>contentForPage('home',{...base,imagePlacements:{hero:placement}}));
  assert.throws(()=>contentForPage('home',{...base,imagePlacements:{unknown:{imageId}}}));
  assert.equal(contentForPage('about',{...base,imagePlacements:{story:{layout:'left'}}}).imagePlacements.story.layout,'left');
  assert.equal(Object.keys(contentForPage('site-appearance',{...base,imagePlacements:{'cta-laptop':{imageId},'footer-background':{mobileImageId}}}).imagePlacements).length,2);
  assert.throws(()=>contentForPage('services',{...base,entries:[{id:imageId,heading:'A',text:'A'},{id:imageId,heading:'B',text:'B'}]}));
});

test("CMS uses fixed page names, bounded fields and code-owned CTA destinations", () => {
  const body = {
    heading: "Synthetic heading",
    body: "Literal <script> text, never executable HTML",
    seoTitle: "Synthetic title",
    seoDescription: "Synthetic description",
  };
  assert.equal(contentBodySchema.parse(body).ctaPath, "/#plan");
  for (const extra of [
    { ctaPath: "javascript:alert(1)" },
    { ctaPath: "https://attacker.invalid" },
    { layout: "custom-script" },
    { imageId: "../../file" },
    { heading: "x".repeat(121) },
    { entries: [{ heading: "", text: "" }] },
    { contactEmail: "not-an-email" },
  ])
    assert.equal(
      contentBodySchema.safeParse({ ...body, ...extra }).success,
      false,
    );
  assert.equal(pageSchema.safeParse("arbitrary-layout").success, false);
  assert.equal(
    saveContentSchema.safeParse({ body, expectedVersion: -1 }).success,
    false,
  );
});

test("CMS cannot be mounted without staff session protection", () => {
  assert.throws(
    () => createApp({ contentRepository: {} }),
    /CMS requires staff sessions/,
  );
});

test("journal and map content validates public URLs, dates, unique records and page placement", () => {
  const base = {
    heading: "Heading",
    body: "",
    seoTitle: "Title",
    seoDescription: "Description",
  };
  const article = {
    slug: "travel-preparation",
    title: "Travel preparation",
    excerpt: "A short introduction",
    body: "Approved article text",
    date: "2026-10-30",
  };
  assert.equal(
    contentForPage("journal", { ...base, articles: [article] }).articles.length,
    1,
  );
  for (const extra of [{ slug: "../private" }, { date: "2026-02-30" }])
    assert.throws(() =>
      contentForPage("journal", {
        ...base,
        articles: [{ ...article, ...extra }],
      }),
    );
  assert.throws(() =>
    contentForPage("journal", { ...base, articles: [article, article] }),
  );
  assert.throws(() => contentForPage("home", { ...base, articles: [article] }));
  const row = { countryCode: "TZ", total: 4, status: "verified" };
  assert.equal(
    contentForPage("travel-footprint", { ...base, footprint: [row] })
      .footprint[0].total,
    4,
  );
  for (const extra of [
    { countryCode: "Zanzibar" },
    { total: -1 },
    { total: 1.5 },
    { status: "demo" },
  ])
    assert.throws(() =>
      contentForPage("travel-footprint", {
        ...base,
        footprint: [{ ...row, ...extra }],
      }),
    );
  assert.throws(() =>
    contentForPage("travel-footprint", { ...base, footprint: [row, row] }),
  );
  assert.throws(() => contentForPage("about", { ...base, footprint: [row] }));
  const countries = JSON.parse(
    readFileSync(
      new URL(
        "../../travel-with-ease-web/src/lib/footprint-countries.json",
        import.meta.url,
      ),
    ),
  );
  assert.deepEqual(
    [...footprintCountryCodes].sort(),
    countries.map((country) => country.code).sort(),
  );
});
