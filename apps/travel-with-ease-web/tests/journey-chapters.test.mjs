import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import photos from "../src/lib/journey-photography.json" with { type: "json" };

const source = file => readFileSync(new URL("../src/" + file, import.meta.url), "utf8");

test("selected journey chapters keep the real hero and CTA and one footprint heading", () => {
  const home = source("components/PublishedHome.astro");
  for (const component of ["CinematicHero", "ServicePanels", "JourneyProcess", "TravelFootprint", "ClosingCta"]) {
    assert.match(home, new RegExp("<" + component + "\\b"));
  }
  assert.match(home, /heading=\{content.heading\} body=\{content.body\} image=\{content.image\}/);
  assert.doesNotMatch(home, /<h2>\{footprint.heading\}/);
  const panels = source("components/ServicePanels.astro");
  assert.match(panels, /<ContentLink href=\{all \? "#plan"/);
  assert.doesNotMatch(panels, /<figcaption|onClick|window.location/);
  assert.match(source("styles/components/journey-editorial.css"), /prefers-reduced-motion: no-preference/);
});

test("additional Drive photographs have responsive, metadata-free real WebP derivatives", async () => {
  assert.deepEqual(Object.keys(photos).sort(), ["coast", "elephants", "garden", "hippos", "park"]);
  for (const photo of Object.values(photos)) {
    assert.ok(photo.alt.length > 20);
    assert.equal(photo.sources.length, 2);
    for (const image of photo.sources) {
      const filename = new URL("../public" + image.src, import.meta.url);
      const metadata = await sharp(filename.pathname).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, image.width);
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.xmp, undefined);
      assert.equal(metadata.iptc, undefined);
    }
  }
});
