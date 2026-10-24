import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setAsyncButtonState } from "../src/lib/async-button.js";
const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
test("async button names and busy status follow the state model", () => {
  const label = {}, attrs = {};
  const button = { dataset: {}, setAttribute: (key, value) => attrs[key] = value, querySelector: () => label };
  for (const [state, name] of [["idle","Send enquiry"],["working","Sending…"],["success","Sent"],["error","Try again"]]) {
    setAsyncButtonState(button, state);
    assert.equal(label.textContent, name);
    assert.equal(attrs["aria-busy"], String(state === "working"));
  }
  assert.throws(() => setAsyncButtonState(button, "unknown"));
});
test("reveal is selected, observer driven and fail-open", () => {
  const script = read("scripts/editorial-motion.ts"), css = read("styles/components/motion.css");
  assert.match(script, /IntersectionObserver/);
  assert.match(script, /setTimeout.*pending.forEach/);
  assert.match(script, /motion.matches/);
  assert.doesNotMatch(script, /addEventListener\("scroll"|ScrollReveal/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /\[data-reveal\]\s*\{[^}]*opacity:\s*0/);
  for (const page of ["privacy", "terms", "contact"]) assert.doesNotMatch(read("pages/" + page + ".astro"), /data-reveal/);
});
test("contact preserves token checks, duplicate guard, reset and manual verification", () => {
  const script = read("scripts/contact-form.ts");
  for (const pattern of [/if\(busy\)return/, /if\(!token\)/, /provider\?\.reset\(widget\)/, /AbortSignal.timeout\(30000\)/, /load.addEventListener\("click"/, /form.reset\(\)/, /setAsyncButtonState\(submit,"working"\)/, /setAsyncButtonState\(submit,"success"\)/, /setAsyncButtonState\(submit,"error"\)/]) assert.match(script, pattern);
});
test("signature motion and calendar failure behaviour remain", () => {
  assert.match(read("components/ScrollExpandSection.astro"), /requestAnimationFrame/);
  assert.match(read("components/ScrollExpandSection.astro"), /passive: true/);
  assert.match(read("styles/components/scroll-expand.css"), /prefers-reduced-motion: reduce/);
  assert.match(read("styles/components/photo-ribbon.css"), /85s linear infinite/);
  assert.match(read("components/EventGalleryRail.astro"), /aria-hidden="true" inert/);
  assert.match(read("scripts/month-calendar.ts"), /retry.addEventListener/);
  assert.match(read("styles/components/month-calendar.css"), /month-loading/);
  assert.doesNotMatch(read("components/EventCalendar.astro"), /iframe/);
});
