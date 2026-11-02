import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import photos from "../src/lib/approved-preview-media.json" with { type: "json" };

test("additional Drive photographs have immutable provenance and bounded metadata-free derivatives", async () => {
  for (const placement of ["hero", "wildlife", "journal", "closing"]) {
    const matches = photos.filter((photo) => photo.placement === placement);
    assert.equal(matches.length, 1);
    const photo = matches[0];
    assert.match(photo.driveId, /^[A-Za-z0-9_-]{10,200}$/);
    assert.match(photo.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(photo.alt.trim());
    assert.equal(
      new Set(photo.sources.map((source) => source.width)).size,
      photo.sources.length,
    );
    for (const source of photo.sources) {
      assert.match(source.src, /^\/media\/[a-z0-9-]+\.webp$/);
      assert.ok(source.src.includes(photo.sourceSha256.slice(0, 12)));
      const bytes = await readFile(
        new URL(`../public${source.src}`, import.meta.url),
      );
      assert.equal(bytes.length, source.bytes);
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.format, "webp");
      assert.equal(metadata.width, source.width);
      assert.ok(source.width <= photo.width && source.width <= 1920);
      assert.equal(metadata.exif, undefined);
      assert.equal(metadata.xmp, undefined);
    }
  }
});
