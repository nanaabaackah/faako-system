import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import approved from "../content/approved-public-release.json" with { type: "json" };
import { publishedServices, serviceSlug } from "../src/lib/services.js";
import { publishedPage } from "../src/lib/published.js";

test("every approved service has one unique public detail path and retains approved copy and fees", () => {
  const services = publishedServices(approved.pages.services);
  assert.deepEqual(services.map(item => item.slug), [
    "travel-readiness-session", "full-trip-planning", "premium-concierge", "group-trip-planning",
  ]);
  for (const item of services) {
    assert.equal(item.text, approved.pages.services.entries[item.index].text);
    assert.equal(publishedPage(`services/${item.slug}`).text, item.text);
    assert.ok(item.fee.includes("GHS"));
  }
  assert.equal(publishedPage("services/missing"), null);
  assert.deepEqual(publishedServices(null), []);
});

test("service URLs ignore fee changes, preserve safe characters and reject duplicate or empty titles", () => {
  assert.equal(serviceSlug("Full Trip Planning · GHS 2,000"), serviceSlug("Full Trip Planning · GHS 3,000"));
  assert.equal(serviceSlug("A / B? · GHS 400"), "a-b");
  assert.throws(() => publishedServices({ entries: [{ heading: "!!!", text: "" }] }));
  assert.throws(() => publishedServices({ entries: [{ heading: "One" }, { heading: "One · GHS 400" }] }));
});

test("service detail generation reads published services and retains CMS image assignments", () => {
  const route = readFileSync(new URL("../src/pages/services/[slug].astro", import.meta.url), "utf8");
  assert.match(route, /getStaticPaths/);
  assert.match(route, /publishedServices\(publishedPage\("services"\)\)/);
  assert.match(route, /placement=\{service.imagePlacement\}/);
  assert.match(route, /An enquiry is not a booking/);
  assert.match(route, /href="#plan"/);
});
