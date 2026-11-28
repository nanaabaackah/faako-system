import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { siteBranding } from "../src/lib/branding.js";
import approved from "../content/approved-public-release.json" with { type: "json" };
const read = name => readFileSync(new URL("../src/" + name, import.meta.url), "utf8");

test("Journal listing follows chosen contemporary editorial design and uses every published story", () => {
  const source = read("components/JournalListing.astro");
  const styles = read("styles/components/journal-listing.css");
  const collection = approved.pages.journal.articles;
  assert.ok(collection.length >= 8);
  assert.match(source, /journal-landing__spotlight-grid/);
  assert.match(source, /journal-landing__hero/);
  assert.match(source, /journal-landing__rail/);
  assert.match(source, /journal-landing__archive-grid/);
  assert.match(source, /orderedItems\.map\(item => \(/);
  assert.match(source, /find\(item => item\.featuredOnJournal\)/);
  assert.match(source, /CollectionFilters client:load scope="journal-archive"/);
  assert.match(styles, /body main \.journal-landing__hero h3 \{ color:#fff; \}/);
  assert.match(styles, /body main \.journal-landing__hero p \{ color:#f5f1e8; \}/);
  assert.match(source, /data-category=\{item\.category/);
  assert.match(source, /data-series=\{item\.series/);
  assert.match(source, /<PlacedImage image=\{feature\.image\}/);
  assert.match(source, /\{copy\.featuredHeading\}/);
  assert.match(source, /\{copy\.archiveHeading\}/);
  assert.match(styles, /@media\(max-width:700px\)/);
  assert.match(styles, /@media\(max-width:420px\)/);
  assert.doesNotMatch(source, /\bemoji\b|\bLorem ipsum\b|fake view/i);
});

test("branding defaults remain TWE Poiret/Quicksand and approved logos", () => {
  const actual = siteBranding(null);
  assert.match(actual.cssVariables, /Poiret One/);
  assert.match(actual.cssVariables, /Quicksand/);
  assert.equal(actual.headerLogo, "/brand/Primary gold.png");
  assert.equal(actual.scrolledLogo, "/brand/dark mode symbol.png");
  assert.equal(actual.footerLogo, "/brand/midnight primary.png");
  assert.equal(actual.favicon, null);
  assert.equal(actual.socialImage, null);
});

test("branding accepts only approved fonts and local published logo references", () => {
  const id = "40000000-0000-4000-8000-000000000001";
  const brand = siteBranding({ branding: {
    headingFont: "outfit", bodyFont: "inter",
    headerLogo: {src: "/media/" + id + ".webp"},
    scrolledLogo: {src:"https://untrusted.invalid/logo.webp"},
    footerLogo: {src:"javascript:alert(1)"},
    favicon: {src: "/media/" + id + ".webp"},
    socialImage: {src: "/media/" + id + "-social.jpg", alt:"TWE"}
  }});
  assert.match(brand.cssVariables, /Outfit/);
  assert.match(brand.cssVariables, /Inter/);
  assert.equal(brand.headerLogo, "/media/" + id + ".webp");
  assert.equal(brand.scrolledLogo, "/brand/dark mode symbol.png");
  assert.equal(brand.footerLogo, "/brand/midnight primary.png");
  assert.equal(brand.favicon, "/media/" + id + ".webp");
  assert.equal(brand.socialImage.src, "/media/" + id + "-social.jpg");
  const blocked = siteBranding({branding: {headingFont:"url(https://bad.invalid)",bodyFont:"serif"}});
  assert.match(blocked.cssVariables, /Poiret One/);
  assert.match(blocked.cssVariables, /Quicksand/);
});

test("CMS Brand & Appearance uses existing private media library and publication workflow", () => {
  const control = readFileSync(new URL("../../travel-with-ease-portal/src/components/BrandAppearance.jsx",import.meta.url), "utf8");
  const editor = readFileSync(new URL("../../travel-with-ease-portal/src/components/WebsiteContent.jsx",import.meta.url), "utf8");
  const base = read("layouts/BaseLayout.astro");
  const footer = read("components/PublicFooter.astro");
  assert.match(control,/Brand and appearance/);
  assert.match(control,/Open asset library/);
  assert.match(control,/<MediaLibrary api=\{api\} session=\{session\}/);
  assert.match(control,/Heading font/);
  assert.match(control,/Body font/);
  assert.match(editor,/featuredOnJournal/);
  assert.match(editor,/<BrandAppearance branding=\{body\.branding\}/);
  assert.match(base,/src=\{branding\.headerLogo\}/);
  assert.match(base,/src=\{branding\.scrolledLogo\}/);
  assert.match(base,/style=\{branding\.cssVariables\}/);
  assert.match(footer,/src=\{branding\.footerLogo\}/);
});
