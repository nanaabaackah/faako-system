import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (name) =>
  readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");

test("closing CTA keeps one CMS-managed action over the lazy Topography treatment", () => {
  const component = source("components/ClosingCta.astro");
  const wrapper = source("components/TopographyBackground.jsx");
  const css = source("styles/components/closing-cta.css");

  assert.match(component, /TopographyBackground client:visible/);
  assert.match(component, /data-closing-expand/);
  assert.match(component, /requestAnimationFrame/);
  assert.match(component, /requiredHeight > height/);
  assert.doesNotMatch(component, /requiredHeight > height \*/);
  assert.match(component, /prefers-reduced-motion: reduce/);
  assert.match(component, /copy\.closingHeading/);
  assert.match(component, /copy\.closingBody/);
  assert.match(component, /copy\.closingCta/);
  assert.match(component, /href="#plan"/);
  assert.equal((component.match(/<ContentLink\b/g) || []).length, 1);
  assert.doesNotMatch(component, /TWE_mockup|astro:assets|<img\b/);

  assert.match(wrapper, /color = "#D8B56A"/);
  assert.match(component, /closing-copy__heading/);
  assert.match(component, /closing-copy__body/);
  assert.match(component, /closing-cta--\$\{variant\}/);
  assert.match(wrapper, /speed=\{0\.18\}/);
  assert.match(wrapper, /markers="none"/);
  assert.match(wrapper, /mouseInteraction=\{false\}/);
  assert.match(wrapper, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(wrapper, /removeEventListener\("change", update\)/);
  assert.match(wrapper, /data-topography-static/);
  assert.match(css, /background: #010c33/);
  assert.match(css, /closing-topography-fallback/);
  assert.match(css, /:global\(\.closing-cta:has\(\.closing-topography-canvas \.topography-canvas\)\)/);
  assert.match(css, /:global\(astro-island\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /clip-path: inset/);
  assert.match(css, /border-radius: var\(--twe-radius-button\)/);
});

test("the vendored React Bits Topography implementation pauses offscreen and disposes WebGL resources", () => {
  const topography = source("components/react-bits/Topography.jsx");

  assert.match(topography, /getContext\('webgl2'/);
  assert.match(topography, /new IntersectionObserver/);
  assert.match(topography, /cancelAnimationFrame\(raf\)/);
  assert.match(topography, /intersection\.disconnect\(\)/);
  assert.match(topography, /gl\.deleteTexture/);
  assert.match(topography, /WEBGL_lose_context/);
});
