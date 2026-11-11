import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = file => readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");

test("homepage keeps the approved editorial image and semantic service-ticket detail links", () => {
  const component = source("components/HomeServices.astro");
  assert.match(component, /<EditorialPhoto/);
  assert.match(component, /placement=\{entries\[0\]\?\.imagePlacement\}/);
  assert.match(component, /serviceSlug\(entry.heading\)/);
  assert.match(component, /<ServiceTicketCard/);
  assert.match(component, /client:load/);
  assert.match(source("components/ServiceTicketCard.jsx"), /moneySegments\(text\)/);
  assert.match(source("components/ServiceTicketCard.jsx"), /data-twe-money/);
  assert.match(source("components/ServiceTicketCard.jsx"), /<a href=\{href\}>/);
  assert.doesNotMatch(component, /figcaption|home-services__grid/);
  const css = source("styles/components/home-services.css");
  assert.match(css, /box-shadow: none/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("all detail families share semantic, wrapping breadcrumbs with decorative Iconsax separators", () => {
  const component = source("components/Breadcrumbs.astro");
  assert.match(component, /<nav[^>]+aria-label="Breadcrumb"/);
  assert.match(component, /<ol>/);
  assert.match(component, /aria-current="page"/);
  assert.match(component, /ArrowRight4 aria-hidden="true" focusable="false"/);
  assert.doesNotMatch(component, /ContentLink/);
  for (const file of ["components/PackageDetail.astro", "components/JournalArticle.astro", "pages/services/[slug].astro", "pages/travel-tips/[slug].astro"]) assert.match(source(file), /<Breadcrumbs /);
  assert.match(source("styles/components/breadcrumbs.css"), /overflow-wrap: anywhere/);
});
