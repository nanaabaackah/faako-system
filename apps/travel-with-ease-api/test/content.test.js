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
import { approvedEditorCopy } from "../../travel-with-ease-portal/src/lib/approved-copy.js";
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

test("Footer content uses stable ordered links and responsive managed background media", () => {
  const background = "40000000-0000-4000-8000-000000000001";
  const mobile = "40000000-0000-4000-8000-000000000002";
  const linkId = "40000000-0000-4000-8000-000000000003";
  const body = contentForPage("footer", {
    heading: "Travel With Ease", body: "Plan with confidence", seoTitle: "Footer", seoDescription: "Footer information",
    contactEmail: "info@travelwitheasegh.com", contactPhone: "+233 20 020 9170",
    imagePlacements: { "footer-background": { imageId: background, mobileImageId: mobile, focalY: 40 } },
    footerLinks: [{ id: linkId, group: "social", label: "Instagram", href: "https://www.instagram.com/travelwitheasegh/", visible: true, order: 0 }],
  });
  assert.equal(body.footerLinks[0].id, linkId);
  assert.deepEqual(contentMediaIds(body), [background, mobile]);
  assert.throws(() => contentForPage("footer", { ...body, footerLinks: [{ ...body.footerLinks[0], href: "javascript:alert(1)" }] }));
  assert.throws(() => contentForPage("home", { ...body }));
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

test("Journal lead selection and brand settings are constrained and tracked as media references", () => {
  const base = { heading:"Fixture", body:"", seoTitle:"Fixture", seoDescription:"Synthetic" };
  const id1="40000000-0000-4000-8000-000000000001";
  const id2="40000000-0000-4000-8000-000000000002";
  const entry = {slug:"sample-article", title:"Synthetic", excerpt:"Summary", body:"Article", date:"2026-11-01"};
  assert.equal(contentForPage("journal",{...base,articles:[{...entry,featuredOnJournal:true}]}).articles[0].featuredOnJournal,true);
  assert.throws(()=>contentForPage("journal",{...base,articles:[{...entry,featuredOnJournal:true},{...entry,slug:"another-article",featuredOnJournal:true}]}));
  assert.throws(()=>contentForPage("journal",{...base,articles:[{...entry,featuredOnJournal:"yes"}]}));
  const selected = contentForPage("site-appearance",{...base,branding:{
    headingFont:"outfit",bodyFont:"inter",headerLogoId:id1,scrolledLogoId:id2,
    footerLogoId:id1,faviconId:id2,socialImageId:id1,
  }});
  assert.equal(selected.branding.headingFont,"outfit");
  assert.equal(selected.branding.bodyFont,"inter");
  assert.deepEqual(contentMediaIds(selected).sort(),[id1,id2].sort());
  const defaults = contentForPage("site-appearance",base).branding;
  assert.equal(defaults.headingFont,"poiret-one");
  assert.equal(defaults.bodyFont,"quicksand");
  assert.equal(defaults.headerLogoId,null);
  for (const invalid of [{headingFont:"Georgia"},{bodyFont:"url(https://bad.invalid)"},{footerLogoId:"https://bad.invalid/file.png"},{script:"<script>"}])
    assert.throws(()=>contentForPage("site-appearance",{...base,branding:invalid}));
});

test("package booking grows to five editable steps without changing personal planning or a four-stage example", () => {
  const approved = JSON.parse(readFileSync(new URL("../../travel-with-ease-web/content/approved-public-release.json", import.meta.url), "utf8"));
  const original = approvedEditorCopy(approved.pages["how-it-works"]);
  const approvedStep = {
    heading: "Travel with your pack",
    text: "You receive your travel pack with all your confirmed bookings, and we walk you through it on WhatsApp before you go.",
  };
  assert.equal(original.processFlows.package.steps.length, 5);
  assert.deepEqual(original.processFlows.package.steps[4], approvedStep);
  assert.equal(original.processFlows.planning.steps.length, 4);
  assert.equal(original.processFlows.package.exampleSteps.length, 4);

  const earlier = structuredClone(original);
  earlier.processFlows.package.steps.pop();
  const parsed = contentForPage("how-it-works", earlier);
  assert.equal(parsed.processFlows.package.steps.length, 5);
  assert.deepEqual(parsed.processFlows.package.steps[4], approvedStep);
  assert.equal(earlier.processFlows.package.steps.length, 4, "Upgrading a historic draft does not mutate stored revisions");
  assert.equal(parsed.processFlows.planning.steps.length, 4);
  assert.equal(parsed.processFlows.package.exampleSteps.length, 4);
  assert.deepEqual(contentForPage("how-it-works", parsed).processFlows.package.steps, parsed.processFlows.package.steps,
    "Revalidating a five-step draft never duplicates the final step");
  const extended = structuredClone(parsed);
  extended.processFlows.package.steps.push({ heading: "Optional sixth step", text: "Approved CMS extension" });
  assert.equal(contentForPage("how-it-works", extended).processFlows.package.steps.length, 6);
  const shortened = structuredClone(parsed);
  shortened.processFlows.package.customStepCount = true;
  shortened.processFlows.package.steps = shortened.processFlows.package.steps.slice(0, 2);
  shortened.processFlows.planning.steps = shortened.processFlows.planning.steps.slice(0, 1);
  shortened.processFlows.planning.exampleSteps = shortened.processFlows.planning.exampleSteps.slice(0, 2);
  const deliberatelyEdited = contentForPage("how-it-works", shortened);
  assert.equal(deliberatelyEdited.processFlows.package.steps.length, 2,
    "Explicitly removed package steps must not be reinserted");
  assert.equal(deliberatelyEdited.processFlows.planning.steps.length, 1);
  assert.equal(deliberatelyEdited.processFlows.planning.exampleSteps.length, 2);
  const tooLong = structuredClone(parsed);
  tooLong.processFlows.package.steps = Array.from({ length: 13 }, (_, i) =>
    ({ heading: `Step ${i + 1}`, text: "Beyond supported CMS limit" }));
  assert.throws(() => contentForPage("how-it-works", tooLong));
});

test("Services cards have separate descriptions and Terms retain Section A/B boundaries", () => {
  const base = { heading: "Fixture", body: "", seoTitle: "Fixture", seoDescription: "Fixture" };
  const entry = { heading: "Planning", text: "Long individual service detail", cardSummary: "Brief listing text" };
  const service = contentForPage("services", { ...base, entries: [entry] });
  assert.equal(service.entries[0].cardSummary, "Brief listing text");
  assert.equal(service.entries[0].text, "Long individual service detail");
  assert.equal(contentForPage("services", {
    ...base, entries: [{ heading: "Planning", text: "Legacy description" }],
  }).entries[0].cardSummary, undefined);
  assert.throws(() => contentForPage("services", { ...base,
    entries: [{ ...entry, cardSummary: "x".repeat(241) }] }));
  const group = contentForPage("terms", { ...base, entries: [
    { heading: "Planning", text: "A", section: "A" },
    { heading: "Packages", text: "B", section: "B" },
  ] });
  assert.deepEqual(group.entries.map(item => item.section), ["A", "B"]);
  assert.throws(() => contentForPage("terms", { ...base, entries: [
    { heading: "Packages", text: "B", section: "B" },
    { heading: "Planning", text: "A", section: "A" },
  ] }));
  assert.throws(() => contentForPage("services", { ...base,
    entries: [{ ...entry, section: "B" }] }));
});
