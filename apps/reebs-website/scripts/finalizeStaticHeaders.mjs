import { createHash } from "node:crypto";
import {
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;
const distRoot = join(appRoot, "dist");
const headersPath = join(distRoot, "_headers");
const redirectsPath = join(distRoot, "_redirects");
const cataloguePath = join(appRoot, "src", "content", "public-catalogue.json");
const hashMarker = "__ASTRO_SCRIPT_HASHES__";

const walk = async (directory) => {
  const entries = await readdir(directory);
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry);
    if ((await stat(path)).isDirectory()) {
      files.push(...(await walk(path)));
    } else {
      files.push(path);
    }
  }

  return files;
};

const hashes = new Set();
const htmlFiles = (await walk(distRoot)).filter((path) => path.endsWith(".html"));

for (const htmlFile of htmlFiles) {
  const html = await readFile(htmlFile, "utf8");
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1] || "";
    const source = match[2] || "";
    if (
      /\bsrc\s*=/i.test(attributes)
      || /\btype\s*=\s*["']application\/ld\+json["']/i.test(attributes)
      || !source
    ) continue;
    const digest = createHash("sha256").update(source).digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }
}

const headerTemplate = await readFile(headersPath, "utf8");
if (!headerTemplate.includes(hashMarker)) {
  throw new Error(`Missing ${hashMarker} in ${headersPath}.`);
}
await writeFile(
  headersPath,
  headerTemplate.replace(hashMarker, Array.from(hashes).sort().join(" ")),
  "utf8",
);

const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
const legacyRedirects = (catalogue.rentals || [])
  .flatMap((item) =>
    (item.legacyPaths || []).map((legacyPath) => `${legacyPath} ${item.path} 301`),
  )
  .sort((left, right) => left.localeCompare(right));
const baseRedirects = (await readFile(redirectsPath, "utf8")).trim();
await writeFile(
  redirectsPath,
  `${baseRedirects}\n${legacyRedirects.join("\n")}\n`,
  "utf8",
);

console.log(
  `Finalized ${hashes.size} CSP hashes and ${legacyRedirects.length} catalogue redirects.`,
);
