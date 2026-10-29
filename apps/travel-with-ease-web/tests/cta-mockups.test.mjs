import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("closing CTA uses the five supplied mockups and responsive image delivery", () => {
  const source = readFileSync(
    new URL("../src/components/ClosingCta.astro", import.meta.url),
    "utf8",
  );
  const css = readFileSync(
    new URL("../src/styles/components/closing-cta.css", import.meta.url),
    "utf8",
  );
  for (let n = 1; n <= 5; n++) {
    assert.ok(source.includes(`TWE_mockup${n}.png`));
    const asset = readFileSync(
      new URL(`../public/media/Mockups/TWE_mockup${n}.png`, import.meta.url),
    );
    assert.equal(asset.subarray(1, 4).toString(), "PNG");
  }
  assert.match(source, /format="webp"/);
  assert.match(source, /widths=\{\[160, 320, 640, 960\]\}/);
  assert.match(source, /loading="lazy"/);
  assert.doesNotMatch(source, /<figcaption/);
  assert.match(css, /grid-template-columns: 0\.8fr 1fr 1\.8fr 0\.65fr 0\.85fr/);
  assert.match(source, /name: "laptop" \},\s*\{ image: phone, name: "phone"/);
  assert.match(source, /aria-hidden="true"/);
  assert.doesNotMatch(source, /Final images will be supplied/);
});
