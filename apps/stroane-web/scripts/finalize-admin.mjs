/* eslint-disable no-undef */
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const outputRoot = join(appRoot, "dist", "admin");
const indexPath = join(outputRoot, "index.html");

let index = await readFile(indexPath, "utf8");
index = index
  .replace(/<title>[\s\S]*?<\/title>/i, "<title>Stroane Admin</title>")
  .replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    '<meta name="description" content="Secure Stroane administration workspace." />',
  )
  .replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
    '<meta name="robots" content="noindex, nofollow" />',
  )
  .replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    '<link rel="canonical" href="https://portal.stroanesolutions.com/login" />',
  );
await writeFile(indexPath, index, "utf8");

await writeFile(
  join(outputRoot, "_headers"),
  `/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.stroanesolutions.com https://api-staging.stroanesolutions.com https://stroane-api-production.up.railway.app; manifest-src 'self'
  Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  X-Robots-Tag: noindex, nofollow
`,
  "utf8",
);

await writeFile(
  join(outputRoot, "robots.txt"),
  "User-agent: *\nDisallow: /\n",
  "utf8",
);

await rm(join(outputRoot, "sitemap.xml"), { force: true });

console.log("Finalized Stroane admin security and indexing headers.");
