// Reuse the approved TTNGH logo at a size suitable for the 110–125px header.
// Generated before Astro builds, not committed as a second master brand asset.
import { createRequire } from "node:module";
import { mkdir, stat } from "node:fs/promises";
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("astro/package.json"))("sharp");
const input = new URL("../public/ttngh-logo-transparent.png", import.meta.url);
const output = new URL("../public/images/brand/ttngh-logo-header.webp", import.meta.url);
await mkdir(new URL("../public/images/brand/", import.meta.url), { recursive: true });
await sharp(input.pathname).resize({ width: 384, withoutEnlargement: true })
  .webp({ quality: 86, effort: 6 }).toFile(output.pathname);
const [original, optimized] = await Promise.all([stat(input), stat(output)]);
if (optimized.size >= original.size) throw new Error("Optimized header logo must be smaller than original asset");
console.log(`TTNGH header logo: ${original.size} → ${optimized.size} bytes`);
