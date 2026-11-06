import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

test("retired demo pages are absent; old landing and collection links redirect safely", () => {
  for (const path of ["../dist/demo", "../src/pages/demo.astro", "../src/pages/demo",
    "../../travel-with-ease-portal/src/demo.js"]) {
    // Empty directories can remain in a working tree; no route files may remain.
    const target = new URL(path, import.meta.url);
    if (existsSync(target)) assert.deepEqual(readdirSync(target, { recursive: true }).filter(name => /\.(astro|html|js)$/.test(name)), []);
  }
  const redirects = readFileSync(new URL("../public/_redirects", import.meta.url), "utf8");
  for (const [old, target] of [["/demo", "/"], ["/demo/packages", "/packages"], ["/demo/journal", "/journal"]])
    assert.ok(redirects.includes(old + " " + target + " 301"));
  assert.doesNotMatch(redirects, /\/demo\/packages\/\*.*\/packages\//, "Never turn synthetic offers into real offers");
});

test("shipped portal bundle does not contain the synthetic workspace adapter", (context) => {
  const directory = new URL("../../travel-with-ease-portal/dist/assets/", import.meta.url);
  // Source-only CI jobs run before the portal is compiled. The TWE foundation
  // workflow builds the portal first and therefore runs this assertion fully.
  if (!existsSync(directory)) {
    context.skip("Portal artifact is not built in this source-only job.");
    return;
  }
  const scripts = readdirSync(directory).filter(name => name.endsWith(".js"));
  assert.ok(scripts.length);
  for (const file of scripts) assert.doesNotMatch(readFileSync(new URL(file, directory), "utf8"),
    /synthetic-not-a-credential|stagingAllowed|demoRole|Only simulated demo data|Example package — not an actual offer/);
});
