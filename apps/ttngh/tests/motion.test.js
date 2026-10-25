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
test("second-pass heroes are CSS-only, visible during entrance and exempt formal pages", () => {
  const css=read("styles/components/motion.css");
  assert.match(css,/prefers-reduced-motion: no-preference/);
  assert.match(css,/page-hero:not\(\.page-hero--formal\)/);
  assert.match(css,/@keyframes editorial-arrive \{ from \{ opacity: \.85/);
  assert.match(css,/@keyframes editorial-image-arrive \{ from \{ opacity: \.94/);
  assert.doesNotMatch(read("components/PageHero.astro"),/data-reveal|data-reveal-pending/);
  assert.doesNotMatch(read("pages/index.astro"),/class="home-hero"[^>]*data-reveal/);
});
test("motion is grouped and excludes footer, paragraphs, verified values and large-grid staggering", () => {
  for (const name of ["index","about","events","programmes"]) {
    const page=read(`pages/${name}.astro`);
    assert.doesNotMatch(page,/<(?:h[1-6]|p|img|a)\b[^>]*data-reveal/);
    assert.equal((page.match(/<ScrollExpandSection\b/g)||[]).length,1);
  }
  assert.match(read("pages/index.astro"),/home-intro home-shell" data-reveal/);
  assert.match(read("pages/index.astro"),/home-impact" data-reveal/);
  assert.doesNotMatch(read("components/ImpactFigures.astro"),/countUp|requestAnimationFrame|setInterval/);
  for(const file of ["SiteFooter","TeamGrid"])assert.doesNotMatch(read(`components/${file}.astro`),/data-reveal|animation-delay/);
});
test("interaction contract uses shared timings, keyboard parity and linked images only", () => {
  const css=read("styles/components/interactions.css");
  assert.match(css,/team-member:has\(a\)/);
  assert.match(css,/:focus-within img \{ transform: scale\(1\.015\)/);
  assert.match(css,/var\(--transition-hover-image\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.doesNotMatch(read("styles/pages/events.css"),/recurring-event:hover/);
  assert.match(read("styles/components/month-calendar.css"),/month-grid \{ transition: opacity var\(--motion-fast\)/);
  for(const token of ["motion-fast","motion-ui","motion-editorial","motion-image","ease-standard","ease-out"])assert.match(read("styles/global.css"),new RegExp(`--${token}:`));
});
test("observer construction and observation errors recover without hiding content", () => {
  const script=read("scripts/editorial-motion.ts");
  assert.match(script,/try \{\s*observer =/);
  assert.match(script,/try \{ observer.observe\(element\); \} catch \{ reveal\(element\); \}/);
  assert.ok(script.indexOf("setTimeout")<script.indexOf('element.setAttribute("data-reveal-pending"'));
});
