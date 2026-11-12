import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentForPage } from "../src/content/schema.js";

const snapshot = JSON.parse(readFileSync(new URL(
  "../../travel-with-ease-web/content/approved-public-release.json", import.meta.url,
)));
// Materialised snapshot images are output; the CMS receives Media UUIDs.
const catalogue = {
  ...snapshot.pages.packages,
  packages: snapshot.pages.packages.packages.map(item => {
    const draft = { ...item };
    delete draft.image;
    delete draft.gallery;
    return draft;
  }),
};

test("approved PDF catalogue validates against the real CMS schema", () => {
  const items = contentForPage("packages", catalogue).packages;
  assert.equal(items.length, 4);
  assert.deepEqual(items.map(item => item.slug),
    ["zanzibar", "nairobi", "singapore", "singapore-kuala-lumpur"]);
  assert.ok(items.every(item => item.occasions.length === 0 && !item.groupFriendly));
  assert.ok(items.every(item => !item.imageId));
});

test("reference months, minor-unit amounts and unpriced packages match approved copy", () => {
  const [zanzibar, nairobi, singapore, combined] = catalogue.packages;
  assert.equal(zanzibar.referenceMonth, "2027-06");
  assert.deepEqual(zanzibar.tiers.map(tier => tier.amountMinor), [2500000, 3200000, 3400000, 3800000]);
  assert.equal(nairobi.referenceMonth, "2027-01");
  assert.deepEqual(nairobi.tiers.map(tier => tier.amountMinor), [2100000, 2210000]);
  for (const item of [singapore, combined]) {
    assert.equal(item.pricingStatus, "coming_soon");
    assert.ok(item.tiers.every(tier => tier.amountMinor === null));
    assert.equal(item.itinerary.length, 0);
  }
  for (const item of [zanzibar, nairobi]) {
    assert.match(item.priceDisclaimer, /include return flights from Accra/);
    assert.match(item.priceDisclaimer, /final payment date/);
  }
});

test("priced packages require a disclaimer, month and complete positive tier prices", () => {
  const item = catalogue.packages[0];
  for (const change of [
    { referenceMonth: "" },
    { referenceMonth: "2027-13" },
    { priceDisclaimer: "" },
    { tiers: [] },
    { tiers: [{ ...item.tiers[0], amountMinor: null }] },
    { tiers: [{ ...item.tiers[0], amountMinor: -1 }] },
    { tiers: [{ ...item.tiers[0], amountMinor: 100.5 }] },
    { tiers: [item.tiers[0], item.tiers[0]] },
    { pricingStatus: "coming_soon" },
    { occasions: ["invented"] },
    { occasions: ["family", "family"] },
  ]) {
    assert.throws(() => contentForPage("packages", {
      ...catalogue, packages: [{ ...item, ...change }],
    }));
  }
});

test("approved planning and package terms remain distinct and contain no payment numbers", () => {
  const terms = contentForPage("terms", snapshot.pages.terms);
  assert.match(terms.entries[0].text, /60% for group/);
  assert.match(terms.entries[5].text, /5,000/);
  assert.match(terms.entries[5].text, /non-refundable/);
  assert.doesNotMatch(JSON.stringify(terms), /GTA licensed|Book Now|\+233\d+/i);
  assert.equal(snapshot.pages["travel-footprint"].footprint.length, 0);
});

test("public Journal and Tips use supplied company copy, not simulated experiences", () => {
  const inputBody = body => {
    const draft = structuredClone(body);
    delete draft.image;
    delete draft.socialImage;
    for (const list of [draft.articles || [], draft.tips || []]) {
      for (const item of list) {
        delete item.image;
        delete item.gallery;
      }
    }
    return draft;
  };
  const journal = contentForPage("journal", inputBody(snapshot.pages.journal));
  const tips = contentForPage("travel-tips", inputBody(snapshot.pages["travel-tips"]));
  const footprint = contentForPage("travel-footprint", snapshot.pages["travel-footprint"]);
  assert.equal(journal.articles.length, 2);
  assert.equal(tips.tips.length, 3);
  assert.equal(footprint.experienceCountries.length, 21);
  assert.equal(journal.articles[0].body, snapshot.pages.about.entries[0].text);
  assert.equal(tips.tips[0].body, snapshot.pages.packages.packages[0].priceDisclaimer);
  assert.equal(tips.tips[1].body, snapshot.pages.terms.entries[5].text);
  assert.ok(tips.tips.every(tip => !tip.relatedArticle ||
    journal.articles.some(article => article.slug === tip.relatedArticle)));
});
