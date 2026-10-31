import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import photography from "../src/lib/assigned-photography.json" with { type: "json" };

test("user-selected footer and how-it-works photos are metadata-free WebP assets with correct responsive dimensions", async () => {
  assert.match(photography.footer.src, /\/b7e55[^/]+\.webp$/);
  assert.equal(photography.howItWorks.length, 2);
  assert.match(photography.howItWorks[0].src, /\/IMG_3328-1440\.webp$/);
  assert.match(photography.howItWorks[1].src, /\/12bacbf0[^/]+\.webp$/);
  for (const photo of [photography.footer, ...photography.howItWorks]) {
    assert.ok(photo.alt.trim());
    const metadata = await sharp(
      await readFile(new URL(`../public${photo.src}`, import.meta.url)),
    ).metadata();
    assert.equal(metadata.width, photo.width);
    assert.equal(metadata.height, photo.height);
    assert.equal(
      new Set(photo.sources.map((source) => source.width)).size,
      photo.sources.length,
    );
    for (const source of photo.sources) {
      const image = await sharp(
        await readFile(new URL(`../public${source.src}`, import.meta.url)),
      ).metadata();
      assert.equal(image.format, "webp");
      assert.equal(image.width, source.width);
      assert.equal(image.exif, undefined);
      assert.equal(image.xmp, undefined);
      assert.ok(source.width <= photo.width);
    }
  }
  assert.ok(
    photography.howItWorks[0].sources.every((source) => source.width <= 1440),
  );
});
