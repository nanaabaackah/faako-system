import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

// Explicit, reviewed local kit only. No download, publishing or database writes.
const [source, target] = process.argv.slice(2);
if (!source || !target || !path.isAbsolute(source) || !path.isAbsolute(target)) throw new Error("Provide absolute reviewed kit and output directories.");
await mkdir(path.join(target, "brand"), { recursive: true });
await mkdir(path.join(target, "og"), { recursive: true });
const inventory = [];
async function emit(input, output, transform) {
  const original = await readFile(path.join(source, input));
  const bytes = await transform(sharp(original, { limitInputPixels: 24_000_000 }).rotate()).toBuffer();
  const metadata = await sharp(bytes).metadata();
  if (metadata.exif || metadata.xmp || metadata.iptc) throw new Error("Private metadata remains.");
  await writeFile(path.join(target, output), bytes);
  inventory.push({ input, output, sourceSha256: createHash("sha256").update(original).digest("hex"), sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, width: metadata.width, height: metadata.height, privateMetadata: false });
  return bytes;
}
await emit("Source-Primary.png", "brand/primary.png", image => image.trim({ threshold: 10 }).resize({ width: 640, withoutEnlargement: true }).png());
for (const [name, size] of [["favicon-16.png",16],["favicon-32.png",32],["favicon-48.png",48],["apple-touch-icon.png",180],["icon-192.png",192],["icon-512.png",512]]) {
  await emit(`public/${name}`, name, image => image.resize(size,size).png());
}
// ICO wraps the sanitized PNG frames, never opaque source metadata.
const frames = await Promise.all([16,32,48].map(size => readFile(path.join(target, `favicon-${size}.png`))));
const header = Buffer.alloc(6 + frames.length * 16); header.writeUInt16LE(1,2); header.writeUInt16LE(frames.length,4);
let offset = header.length;
frames.forEach((bytes,index) => { const at = 6 + index * 16; header[at] = [16,32,48][index]; header[at+1] = header[at]; header.writeUInt16LE(1,at+4); header.writeUInt16LE(32,at+6); header.writeUInt32LE(bytes.length,at+8); header.writeUInt32LE(offset,at+12); offset += bytes.length; });
await writeFile(path.join(target,"favicon.ico"), Buffer.concat([header,...frames]));
for (const name of ["default","kenya","zanzibar"]) {
  const meta = await sharp(path.join(source, `public/og/${name}.jpg`)).metadata();
  if (meta.width !== 1200 || meta.height !== 630) throw new Error("Review the sharing crop before importing.");
  await emit(`public/og/${name}.jpg`, `og/${name}.jpg`, image => image.jpeg({quality:90, mozjpeg:true}));
}
console.log(JSON.stringify(inventory,null,2));
