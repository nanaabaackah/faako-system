import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getPortalModules } from "../src/lib/portalModules.js";
test("module groups contain only existing permitted destinations", () => {
  const navigation = [["overview","Overview"],["settings","Account"],["content","Content"],["appearance","Appearance"],["forms","Enquiry forms"],["media","Media"]];
  const modules = getPortalModules(navigation);
  assert.deepEqual(modules.map(m=>m.id), ["overview","enquiries","website","media"]);
  assert.deepEqual(modules.find(m=>m.id==="enquiries").children.map(c=>c.id), ["forms"]);
  assert.deepEqual(modules.find(m=>m.id==="website").children.map(c=>c.id), ["content","appearance"]);
  assert.deepEqual(getPortalModules([["overview","Overview"],["settings","Account"]]).map(m=>m.id), ["overview"]);
});
test("portal shell uses shared primitives and site-matched font definitions without relaxing browser CSP", () => {
  const source = path => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(source("../src/components/PortalNavigation.jsx"), /<ErpNavSidebar/);
  assert.match(source("../src/App.jsx"), /<ErpShellTopbar/);
  assert.match(source("../src/App.jsx"), /dailyRefreshHourUtc={2}/);
  const css = source("../src/styles/typography.css");
  for (const family of ["Poiret One", "Quicksand", "Inter"]) assert.ok(css.includes(family));
  assert.doesNotMatch(css, /Montserrat|https?:\/\//);
  assert.match(source("../public/_headers"), /font-src 'self' data:/);
});
