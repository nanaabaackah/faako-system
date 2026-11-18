import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentForPage } from "../src/content/schema.js";
import { editorialFields, editorialValues, approvedTravellerReviews } from "../src/content/editorial-fields.js";
import { approvedEditorCopy } from "../../travel-with-ease-portal/src/lib/approved-copy.js";

const release = JSON.parse(readFileSync(new URL("../../travel-with-ease-web/content/approved-public-release.json", import.meta.url)));
const base = { heading:"Fixture", body:"", seoTitle:"Fixture", seoDescription:"Synthetic only" };
const read = path => readFileSync(new URL("../../travel-with-ease-web/src/" + path, import.meta.url), "utf8");
const sources = [
  "layouts/BaseLayout.astro", "components/CinematicHero.astro", "components/PublishedHome.astro",
  "components/HomeServices.astro", "components/FeaturedJourneys.astro", "components/TravelTips.astro",
  "components/ClosingCta.astro", "components/TravellerReviews.astro", "components/CinematicEnquiry.astro",
  "components/EnquiryForm.jsx", "components/JourneyProcess.astro", "components/HomeJourneyStepper.jsx",
  "components/HowItWorksTabs.astro", "components/PublicFooter.astro", "components/FloatingActions.astro",
  "components/ServicePanels.astro", "pages/services/[slug].astro", "components/PackageListing.astro",
  "components/PackageDetail.astro", "components/PackagePrices.astro", "components/JournalListing.astro",
  "components/JournalArticle.astro"
].map(read).join("\n");
test("every declared editorial field is scoped, prefilled and connected to a real public renderer", () => {
  for (const [page, fields] of Object.entries(editorialFields)) {
    const values = editorialValues(page);
    assert.equal(Object.keys(values).length, fields.length);
    for (const [key, label, fallback] of fields) {
      assert.ok(label && fallback);
      assert.ok(sources.includes("." + key), `Missing renderer for ${page}.${key}`);
    }
    assert.deepEqual(contentForPage(page, {...base, editorialCopy: values}).editorialCopy, values);
  }
  assert.throws(() => contentForPage("about", {...base, editorialCopy:{closingHeading:"No"}}));
  assert.throws(() => contentForPage("site-appearance", {...base, editorialCopy:{whatsappUrl:"javascript:alert(1)"}}));
  assert.throws(() => contentForPage("site-appearance", {...base, editorialCopy:{instagramUrl:"https://example.com/"}}));
  assert.equal(editorialValues("home",{closingHeading:"Updated"}).closingHeading,"Updated");
  assert.equal(editorialValues("home",{closingHeading:"Updated"}).heroSecondary,"Explore Packages");
});
test("homepage review edits and removal are independent, and not accepted on unrelated pages",()=>{
  assert.deepEqual(release.pages.home.reviews,approvedTravellerReviews);
  const draft = approvedEditorCopy(release.pages.home);
  const revised = contentForPage("home",{...draft,reviews:[{preview:"Edited quote",more:"Full review"}]});
  assert.deepEqual(revised.reviews,[{preview:"Edited quote",more:"Full review"}]);
  assert.deepEqual(contentForPage("home",{...draft,reviews:[]}).reviews,[]);
  assert.throws(()=>contentForPage("home",{...draft,reviews:[{preview:"",more:""}]}));
  assert.throws(()=>contentForPage("about",{...base,reviews:[]}));
});
test("existing packages retain approved photos and galleries unless explicitly cleared",()=>{
  const draft=contentForPage("packages",approvedEditorCopy(release.pages.packages));
  assert.deepEqual(draft.packages.map(record=>record.homeFeatureOrder),[1,2,0,0]);
  assert.ok(draft.packages.every(record=>record.retainApprovedGallery && record.retainApprovedImage));
  assert.equal(contentForPage("packages",{...draft,packages:[{...draft.packages[0],retainApprovedGallery:false,retainApprovedImage:false}]}).packages[0].retainApprovedGallery,false);
  assert.throws(()=>contentForPage("packages",{...draft,packages:[{...draft.packages[0],homeFeatureOrder:3}]}));
});
