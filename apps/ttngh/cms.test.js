import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchCmsDocuments, contentPath } from "./src/lib/cms-source.js";
import { validateCmsDocuments } from "./src/lib/cms-validation.js";
import { readFileSync } from "node:fs";
import { pressCoverage } from "./src/content/press.js";
import { galleryAlbums } from "./src/content/gallery.js";
import { eventStories } from "./src/content/event-stories.js";
test("event recaps have unique local routes and existing photos, without invented dates", () => {
  assert.equal(eventStories.length, 4);
  assert.equal(new Set(eventStories.map(story => story.slug)).size, 4);
  for (const story of eventStories) {
    assert.ok(story.title && story.summary && story.paragraphs.length);
    assert.equal(story.startDate, undefined);
    for (const photo of [story.image, ...story.photos]) {
      assert.ok(photo.width && photo.height && photo.alt);
      assert.ok(readFileSync(new URL("./public" + photo.src, import.meta.url)).length);
    }
  }
});
test("press references use the supplied publishers without invented dates", () => {
  assert.deepEqual(pressCoverage.map(item => new URL(item.href).hostname), ["www.pulse.com.gh", "yemmey.com"]);
  for (const item of pressCoverage) { assert.ok(item.summary.length < 320); assert.equal(item.publishedAt, undefined); }
});
test("local gallery contains bounded reviewed WebP images and source IDs without CMS", () => {
  const base = new URL("./public/images/gallery/", import.meta.url);
  const albums = galleryAlbums;
  assert.equal(albums.length, 2);
  assert.equal(albums[0].title, "African Science Academy");
  const ids = new Set();
  for (const album of albums) for (const photo of album.photos) {
    assert.ok(photo.alt && photo.driveId && photo.sourceName);
    assert.ok(photo.width > 0 && photo.height > 0);
    assert.ok(!ids.has(photo.driveId)); ids.add(photo.driveId);
    const bytes = readFileSync(new URL(photo.file, base));
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.ok(bytes.length < 250000);
  }
});
const settings = {_id:"siteSettings",_type:"siteSettings",publishState:"published",organisationName:"Test organisation",tagline:"Test tagline",summary:"Test summary",email:"test@example.org"};
test("news cards open local illustrated summaries and cite full external reports", () => {
  const cards=readFileSync(new URL("./src/components/PressCoverage.astro",import.meta.url),"utf8");
  const detail=readFileSync(new URL("./src/pages/news/coverage/[slug].astro",import.meta.url),"utf8");
  assert.match(cards,/href=\{`\/news\/coverage\/\$\{item.slug\}`\}/);
  assert.match(detail,/href=\{story.href\}/);
  for(const story of pressCoverage) {
    assert.ok(story.image.src && story.supportingImage.src && story.paragraphs.length);
    assert.ok(story.paragraphs.join(" ").split(/\s+/).length < 150);
  }
  const gallery=readFileSync(new URL("./src/pages/gallery.astro",import.meta.url),"utf8");
  assert.doesNotMatch(gallery,/contentOfType|cms-source/);
});
test("CMS is optional locally but required/partial configuration fails closed", async () => {
  assert.deepEqual(await fetchCmsDocuments({}), []);
  for (const env of [{TTNGH_CMS_REQUIRED:"true"},{SANITY_PROJECT_ID:"fixture"},{SANITY_PROJECT_ID:"../bad",SANITY_DATASET:"production"}]) await assert.rejects(fetchCmsDocuments(env));
});
test("CMS uses published perspective, private build token and non-redirecting requests", async () => {
  const docs = await fetchCmsDocuments({SANITY_PROJECT_ID:"fixture",SANITY_DATASET:"production",SANITY_READ_TOKEN:"fixture-only"}, async (url, options) => {
    assert.equal(url.searchParams.get("perspective"), "published");
    assert.match(url.searchParams.get("query"), /drafts\.\*\*/);
    assert.match(url.searchParams.get("query"), /versions\.\*\*/);
    assert.equal(options.headers.Authorization,"Bearer fixture-only");
    assert.equal(options.redirect,"error");
    return {ok:true,json:async()=>({result:[settings,{...settings,_id:"drafts.siteSettings"}]})};
  });
  assert.equal(docs.length,1);
});
test("CMS outages and malformed records stop deployment", async () => {
  const env={SANITY_PROJECT_ID:"fixture",SANITY_DATASET:"production"};
  await assert.rejects(fetchCmsDocuments(env, async()=>({ok:false})));
  await assert.rejects(fetchCmsDocuments(env, async()=>({ok:true,json:async()=>({result:{}})})));
  await assert.rejects(fetchCmsDocuments(env, async()=>({ok:true,json:async()=>({result:[{...settings,email:"invalid"}]})})));
});
test("singleton collisions fail and content paths preserve public route families", () => {
  assert.throws(()=>validateCmsDocuments([settings,{...settings,_id:"duplicate"}]));
  for (const [type,path] of [["programme","programmes"],["newsArticle","news"],["resource","resources"]]) assert.equal(contentPath({_type:type,slug:{current:"approved-content"}}),`/${path}/approved-content`);
});
