import assert from "node:assert/strict";
import test from "node:test";
import { isInternalWebsiteContentSection } from "./websiteContent.js";

test("inventory templates are private portal content", () => {
  assert.equal(isInternalWebsiteContentSection("inventory-templates"), true);
  assert.equal(isInternalWebsiteContentSection(" INVENTORY-TEMPLATES "), true);
});

test("approved storefront sections remain public", () => {
  for (const section of ["homepage", "catalogue", "policies", "contact"]) {
    assert.equal(isInternalWebsiteContentSection(section), false);
  }
});
