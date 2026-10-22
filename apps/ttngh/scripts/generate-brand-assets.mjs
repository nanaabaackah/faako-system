// Deterministic composition of the existing brand artwork; no redesigned logo.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
// Use Astro's installed image engine for this one-off asset generation task.
const sharp = createRequire(require.resolve('astro/package.json'))('sharp');
const root = new URL('../public/', import.meta.url);
const logo = await readFile(new URL('ttngh-logo-transparent.png', root));
await mkdir(new URL('images/social/', root), { recursive: true });
const fitted = await sharp(logo).resize({ width: 960, height: 440, fit: 'inside' }).toBuffer();
const meta = await sharp(fitted).metadata();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#ffffff' } })
  .composite([{ input: fitted, left: Math.round((1200-meta.width)/2), top: Math.round((630-meta.height)/2) }])
  .png().toFile(new URL('images/social/ttngh-default.png', root).pathname);
const icon = await sharp(await readFile(new URL('favicon_io/android-chrome-512x512.png', root))).resize(128,128).png({ compressionLevel: 9, palette: true }).toBuffer();
await writeFile(new URL('favicon.svg', root), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512"><title>The Thriving Network GH</title><rect width="512" height="512" rx="32" fill="white"/><image width="512" height="512" xlink:href="data:image/png;base64,${icon.toString('base64')}"/></svg>\n`);
await copyFile(new URL('favicon_io/favicon.ico', root), new URL('favicon.ico', root));
