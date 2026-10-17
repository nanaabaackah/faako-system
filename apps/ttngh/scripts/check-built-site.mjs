import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve("dist");
assert.ok(existsSync(root), "Run the production build first");
const files = readdirSync(root, { recursive: true }).filter(file => file.endsWith(".html"));
const titles = new Set();
const descriptions = new Set();
for (const file of files) {
  const html = readFileSync(join(root, file), "utf8");
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: expected one H1`);
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  const description = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
  assert.ok(title && !titles.has(title), `${file}: missing/duplicate title`);
  assert.ok(description && !descriptions.has(description), `${file}: missing/duplicate description`);
  titles.add(title);
  descriptions.add(description);
  assert.match(html, /<link rel="canonical" href="https:\/\//, `${file}: canonical`);
  assert.match(html, /<meta property="og:image" content="https:\/\//, `${file}: OG image`);
  for (const match of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) {
    const data = JSON.parse(match[1]);
    assert.ok(data["@graph"].some(item => item["@type"] === "WebPage"));
  }
  for (const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)(?:[?#][^"]*)?"/g)) {
    const path = decodeURI(match[1]);
    assert.ok(existsSync(join(root, path)) || existsSync(join(root, path, "index.html")), `${file}: missing local target ${path}`);
  }
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    // Astro can serialize an intentional empty alt as a bare HTML attribute.
    assert.match(match[0], /\balt(?:=|\s|>)/, `${file}: missing alt`);
  }
}
console.log(`Verified ${files.length} HTML pages: unique metadata, one H1, JSON-LD, local assets and destinations.`);
