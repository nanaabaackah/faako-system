import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchCmsDocuments, contentPath } from "./src/lib/cms-source.js";
import { validateCmsDocuments } from "./src/lib/cms-validation.js";
const settings = {_id:"siteSettings",_type:"siteSettings",publishState:"published",organisationName:"Test organisation",tagline:"Test tagline",summary:"Test summary",email:"test@example.org"};
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
