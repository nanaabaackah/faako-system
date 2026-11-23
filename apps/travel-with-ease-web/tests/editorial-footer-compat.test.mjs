import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = new URL("../", import.meta.url);
const run = (page, snapshotPath = "") => JSON.parse(execFileSync(
  process.execPath,
  ["--input-type=module", "-e", `import { siteCopy } from "./src/lib/editorial-copy.js"; console.log(JSON.stringify(siteCopy(${JSON.stringify(page)})));`],
  {
    cwd: root,
    env: { ...process.env, TWE_CONTENT_SNAPSHOT: snapshotPath },
    encoding: "utf8",
  },
));

test("approved baseline retains required footer business details before first CMS footer publication", () => {
  const footer = run("footer");
  assert.match(footer.companyDetails, /BN045370826/);
  assert.match(footer.companyDetails, /TWE Concierge/);
  assert.match(footer.companyDetails, /96245096/);
});

test("legacy site-appearance footer fields survive dedicated footer CMS migration", () => {
  const cache = fileURLToPath(new URL("../node_modules/.cache/", import.meta.url));
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(path.join(cache, "twe-footer-compat-"));
  const snapshot = path.join(dir, "published.json");
  const legacy = {
    version: 1,
    pages: {
      "site-appearance": { editorialCopy: {
        navCta: "Legacy navigation",
        companyDetails: "Legacy company details",
        whatsappUrl: "https://wa.me/233200000000",
      } },
    },
  };
  writeFileSync(snapshot, JSON.stringify(legacy));
  assert.equal(run("footer", snapshot).companyDetails, "Legacy company details");
  assert.equal(run("site-appearance", snapshot).whatsappUrl, "https://wa.me/233200000000");

  legacy.pages.footer = { editorialCopy: {
    companyDetails: "Updated footer company details",
    whatsappUrl: "https://wa.me/233211111111",
  } };
  writeFileSync(snapshot, JSON.stringify(legacy));
  assert.equal(run("footer", snapshot).companyDetails, "Updated footer company details");
  assert.equal(run("site-appearance", snapshot).whatsappUrl, "https://wa.me/233211111111");
  assert.equal(run("site-appearance", snapshot).navCta, "Legacy navigation");
});
