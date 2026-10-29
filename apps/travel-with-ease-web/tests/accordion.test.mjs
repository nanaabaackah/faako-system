import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
test("disclosures use native keyboard and no-JavaScript semantics", () => {
  const component = read("../src/components/Accordion.astro");
  assert.match(component, /<details class="twe-accordion">/);
  assert.match(component, /<summary>/);
  assert.match(component, /class="accordion-question">\{title\}<\/span>/);
  assert.match(component, /name="Add"/);
  const css = read("../src/styles/components/accordion.css");
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /min-height: 76px/);
  assert.doesNotMatch(component, /<script|aria-expanded|role="button"|transition:.*height/);
});
test("FAQ entries opt in without converting other published content", () => {
  assert.match(read("../src/pages/[contentPage].astro"), /accordion=\{Astro.params.contentPage === "faqs"\}/);
  assert.match(read("../src/components/PublishedContent.astro"), /accordion = false/);
  assert.doesNotMatch(read("../src/components/DemoWebsite.astro"), /<details|<summary/);
});
