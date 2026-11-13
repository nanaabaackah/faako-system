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
  for (const component of [listing, home]) {
    assert.match(component, /<PackageTicketCard[\s\S]*?client:load/);
    assert.match(component, /imageSrcSet=\{/);
    assert.match(component, /mobileImageSrcSet=\{/);
  }
  const ticket = source("components/PackageTicketCard.jsx");
  assert.match(ticket, /<Heading><a href=\{href\}>\{title\}<\/a><\/Heading>/);
  assert.match(ticket, /aria-label=\{`Explore \$\{title\} package`\}/);
  assert.match(ticket, /moneySegments\(text\)/);
  assert.match(ticket, /backContent=\{/);
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

test("enquiry uses the shared versioned questionnaire and catalogue-aware entry context", () => {
  const enquiry = source("components/EnquiryForm.jsx");
  assert.match(enquiry, /QUESTIONNAIRE_VERSION/);
  assert.match(enquiry, /applicableQuestionIds/);
  assert.match(enquiry, /resolveEntry\(catalogue\)/);
  assert.match(enquiry, /packageSlug/);
  assert.match(enquiry, /serviceSlug/);
  assert.doesNotMatch(enquiry, /localStorage/);
});

test("approved package itineraries use restrained AnimatedList and remain server-rendered", () => {
  const detail = source("components/PackageDetail.astro");
  const island = source("components/PackageItinerary.jsx");
  const style = source("styles/components/package-itinerary-interactive.css");
  assert.match(detail, /<PackageItinerary[\s\S]*?client:visible/);
  assert.match(detail, /\.sort\(\(a, b\) => a\.day - b\.day\)/);
  assert.doesNotMatch(detail, /<Accordion/);
  assert.match(island, /import AnimatedList from "\.\/reactbits\/AnimatedList\.jsx"/);
  assert.match(island, /renderItem=\{item =>/);
  assert.match(island, /semantic="list"/);
  assert.match(source("components/reactbits/AnimatedList.jsx"), /role=\{listMode \? 'listitem' : 'option'\}/);
  assert.match(island, /showGradients=\{false\}/);
  assert.match(island, /frame=\{false\}/);
  assert.match(island, /animation="fade"/);
  assert.match(island, /gap=\{6\}/);
  assert.match(island, /maxHeight=\{460\}/);
  assert.match(island, /stagger=\{0\.05\}/);
  assert.match(style, /overflow-y: auto/);
  assert.match(style, /background: var\(--al-tile\)/);
  assert.match(style, /max-height: 460px/);
  assert.match(style, /animated-list\[data-animated\].*item:not\(\[data-state\]\) \{ opacity: 1; \}/);
  assert.equal(approved.pages.packages.packages.find(item => item.slug === "zanzibar").itinerary.length, 6);
  assert.equal(approved.pages.packages.packages.find(item => item.slug === "nairobi").itinerary.length, 4);
});

test("existing approved package photographs use Masonry without drag, with native link fallback", () => {
  const detail = source("components/PackageDetail.astro");
  const gallery = source("components/PackageMasonryGallery.astro");
  const masonry = source("components/PackageMasonry.jsx");
  const style = source("styles/components/package-masonry.css");
  assert.match(detail, /<PackageMasonryGallery images=\{item\.gallery \|\| \[\]\} \/>/);
  assert.match(gallery, /<PackageMasonry[\s\S]*?client:visible/);
  assert.match(gallery, /twe-package-gallery__fallback/);
  assert.match(gallery, /href=\{image\.src\}/);
  assert.match(gallery, /alt=\{image\.alt\}/);
  assert.match(masonry, /import Masonry from "\.\/reactbits\/Masonry\.jsx"/);
  assert.match(masonry, /draggable=\{false\}/);
  assert.match(masonry, /hoverEffect="none"/);
  assert.match(masonry, /lightbox/);
  assert.match(style, /astro-island\[ssr\] \{ display: block; min-height: 1px; \}/);
  assert.ok(approved.pages.packages.packages.some(item => item.gallery?.length > 0));
});
