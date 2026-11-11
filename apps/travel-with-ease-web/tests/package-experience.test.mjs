import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import approved from "../content/approved-public-release.json" with { type: "json" };

const source = file => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("published package cards retain native links to generated detail routes", () => {
  const listing = source("components/PackageListing.astro");
  const detailRoute = source("pages/packages/[slug].astro");
  const home = source("components/FeaturedJourneys.astro");
  assert.match(listing, /href=\{`\$\{prefix\}\/\$\{item.slug\}`\}/);
  assert.match(home, /href=\{`\/packages\/\$\{item.slug\}`\}/);
  assert.match(detailRoute, /getStaticPaths/);
  assert.match(detailRoute, /params: \{ slug: item.slug \}/);
  for (const item of approved.pages.packages.packages) {
    assert.ok(item.overview);
    assert.ok(item.inclusions.length);
    assert.ok(item.exclusions.length);
    assert.match(item.slug, /^[a-z0-9-]+$/);
  }
});

test("package details expose the published facts, price tiers, inclusions and conditional itinerary", () => {
  const detail = source("components/PackageDetail.astro");
  for (const id of ["package-overview", "package-inclusions", "package-itinerary"]) {
    assert.ok(detail.includes(`id="${id}"`));
    assert.ok(detail.includes(`href="#${id}"`));
  }
  assert.match(source("components/PackagePrices.astro"), /id="package-pricing"/);
  assert.match(detail, /<PackagePrices item=\{item\}/);
  assert.match(detail, /item\.itinerary\?\.length/);
  assert.match(detail, /item\.exclusions/);
  assert.match(detail, /An enquiry is not a booking/);
});

test("expanded process is page-only and examples do not claim to be a real client booking", () => {
  const process = source("components/JourneyProcess.astro");
  assert.match(process, /\{page \? \(/);
  assert.match(process, /\{practicalSteps\[index\] &&/);
  assert.match(process, /<HomeJourneyStepper[\s\S]*?client:visible/);
  assert.match(process, /<noscript>[\s\S]*?journey-process__fallback/);
  assert.match(process, /page && <section class="planning-example/);
  assert.match(process, /not a real client story or a confirmed offer/);
  assert.match(process, /publishedPage\("packages"\)/);
  assert.match(process, /Package deposit terms do not automatically apply/);
});

test("enquiry selects explicitly bind Faako values without depending on a native event name", () => {
  const enquiry = source("components/EnquiryForm.jsx");
  for (const name of ["enquiryType", "service"]) {
    const select = enquiry.match(new RegExp(`<SelectField name="${name}"[\\s\\S]*?</SelectField>`))?.[0];
    assert.ok(select);
    assert.match(select, /onChangeValue=/);
    assert.ok(select.includes(`${name}: value`));
    assert.doesNotMatch(select, /onChange=\{update\}/);
  }
});
