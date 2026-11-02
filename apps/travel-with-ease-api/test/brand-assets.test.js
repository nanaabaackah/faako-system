import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFile } from "node:fs/promises";
const root = new URL("../../travel-with-ease-web/public/", import.meta.url);
test("official favicon sizes and sharing cards have correct dimensions and no private metadata", async () => {
  for (const [filename,width,height] of [["favicon-48.png",48,48],["apple-touch-icon.png",180,180],["icon-192.png",192,192],["icon-512.png",512,512],...["default","kenya","zanzibar"].map(name=>[`og/${name}.jpg`,1200,630])]) {
    const image = await sharp(await readFile(new URL(filename,root))).metadata();
    assert.equal(image.width,width); assert.equal(image.height,height);
    assert.equal(image.exif,undefined); assert.equal(image.xmp,undefined); assert.equal(image.iptc,undefined);
  }
  const ico = await readFile(new URL("favicon.ico",root));
  assert.equal(ico.readUInt16LE(2),1); assert.equal(ico.readUInt16LE(4),3);
});

test("approved preview photos match the source inventory and contain no private metadata", async () => {
  const photos = JSON.parse(await readFile(new URL("../../travel-with-ease-web/src/lib/approved-preview-media.json", import.meta.url), "utf8"));
  const inventory = JSON.parse(await readFile(new URL("../../../docs/apps/travel-with-ease/media-source-inventory.json", import.meta.url), "utf8"));
  assert.equal(photos.length, 6);
  assert.equal(new Set(photos.map(photo => photo.driveId)).size, photos.length);
  for (const photo of photos) {
    const source = inventory.files.find(file => file.driveId === photo.driveId);
    assert.equal(source.sha256, photo.sourceSha256);
    assert.equal(source.altText, photo.alt);
    assert.equal(source.folder, photo.country);
    assert.match(source.usageApproval, /user confirmed/);
    for (const variant of photo.sources) {
      const bytes = await readFile(new URL(`.${variant.src}`, root));
      const image = await sharp(bytes).metadata();
      assert.equal(image.width, variant.width);
      assert.equal(bytes.length, variant.bytes);
      assert.equal(image.exif, undefined);
      assert.equal(image.xmp, undefined);
      assert.equal(image.iptc, undefined);
    }
  }
});
