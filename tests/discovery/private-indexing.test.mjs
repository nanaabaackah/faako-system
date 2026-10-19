import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const privateApps = [
  "apps/dev-erp",
  "apps/faako-erp",
  "apps/reebs-portal",
  "apps/reebs-water",
  "apps/travel-with-ease-portal",
];

test("active private application shells and responses opt out of indexing", async () => {
  for (const app of privateApps) {
    const [html, robots, headers] = await Promise.all([
      readFile(`${app}/index.html`, "utf8"),
      readFile(`${app}/public/robots.txt`, "utf8"),
      readFile(`${app}/public/_headers`, "utf8"),
    ]);

    assert.match(html, /<meta\s+name="robots"\s+content="noindex[,s]/i, `${app} HTML`);
    assert.match(robots, /^User-agent:\s*\*\s*\nDisallow:\s*\/\s*$/i, `${app} robots`);
    assert.match(headers, /X-Robots-Tag:\s*noindex,\s*nofollow,\s*noarchive/i, `${app} headers`);
  }
});

test("the private REEBS Portal does not own a public sitemap", async () => {
  await assert.rejects(access("apps/reebs-portal/public/sitemap.xml"));
});
