import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

test("portal risky actions use accessible dialogs instead of browser confirms", () => {
  const files = ["App.jsx", "components/WebsiteContent.jsx", "components/MediaLibrary.jsx", "components/EmailTemplates.jsx", "components/StaffAccess.jsx", "components/AccountSettings.jsx"];
  const combined = files.map(source).join("\n");
  assert.doesNotMatch(combined, /window\.confirm/);
  assert.match(combined, /ERPConfirmDialog/);
  assert.match(source("components/WebsiteContent.jsx"), /ERPModal[\s\S]*Publication progress/);
});

test("TWE actions expose stable loading and reduced-motion states", () => {
  const button = source("components/ActionButton.jsx");
  const styles = source("styles/global.css");
  assert.match(button, /aria-busy/);
  assert.match(button, /loadingLabel/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /twe-action-spinner/);
});

test("routine portal mutations use the shared toast system", () => {
  for (const file of ["components/WebsiteContent.jsx", "components/Enquiries.jsx", "components/MediaLibrary.jsx", "components/EmailTemplates.jsx"]) {
    assert.match(source(file), /useToast/);
    assert.match(source(file), /pushToast/);
  }
});
