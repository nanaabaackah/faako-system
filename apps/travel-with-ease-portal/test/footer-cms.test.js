import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Footer is a dedicated CMS section with managed branding, background, links and contact details", () => {
  const editor = read("../src/components/WebsiteContent.jsx");
  const brand = read("../src/components/BrandAppearance.jsx");
  assert.match(editor, /'footer'/);
  assert.match(editor, /Business email address/);
  assert.match(editor, /Business phone number/);
  assert.match(editor, /Navigation, social media and legal links/);
  assert.match(editor, /Show this link/);
  assert.match(editor, /Move up/);
  assert.match(editor, /assetKeys=\{\['footerLogoId'\]\}/);
  assert.match(brand, /assetKeys = null/);
});

test("Footer initialization inherits existing managed values without publishing or overwriting them", () => {
  const editor = read("../src/components/WebsiteContent.jsx");
  assert.match(editor, /page === "footer" && !item/);
  assert.match(editor, /content\/site-appearance/);
  assert.match(editor, /content\/contact/);
  assert.match(editor, /autosave\.reset\(draft/);
  assert.doesNotMatch(editor, /page === "footer"[\s\S]{0,500}publication\("publish"\)/);
});
