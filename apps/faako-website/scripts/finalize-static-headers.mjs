import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;
const distRoot = join(appRoot, "dist");
const headersPath = join(distRoot, "_headers");
const marker = "__ASTRO_SCRIPT_HASHES__";

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
    if (/\bsrc\s*=/i.test(attributes) || !source) continue;
    const digest = createHash("sha256").update(source).digest("base64");
    hashes.add(`'sha256-${digest}'`);
  }
}

const headerTemplate = await readFile(headersPath, "utf8");
if (!headerTemplate.includes(marker)) {
  throw new Error(`Missing ${marker} in ${headersPath}.`);
}

await writeFile(
  headersPath,
  headerTemplate.replace(marker, Array.from(hashes).sort().join(" ")),
  "utf8",
);

console.log(`Added ${hashes.size} inline-script hashes to dist/_headers.`);
