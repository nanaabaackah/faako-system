// Build-time optimization of the approved TTNGH logo for its 110–125px navigation slot.
// Keep the original PNG intact for email templates and fallback image rendering.
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("astro/package.json"))("sharp");
const source = new URL("../public/ttngh-logo-transparent.png", import.meta.url);
const folder = new URL("../public/images/brand/", import.meta.url);
await mkdir(folder, { recursive: true });
for (const width of [128, 256, 384]) {
  await sharp(source.pathname)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 5 })
    .toFile(new URL(`ttngh-nav-logo-${width}.webp`, folder).pathname);
}
