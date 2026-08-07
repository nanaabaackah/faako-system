import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const compatibilityRoot = join(appRoot, "dist");
const storefrontRoot = join(appRoot, "dist", "storefront");
const adminRoot = join(appRoot, "dist", "admin");

const walk = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const read = (root, path) => readFileSync(join(root, path), "utf8");

test("root build keeps the existing Cloudflare deployment operational during cutover", () => {
  assert.equal(existsSync(join(compatibilityRoot, "index.html")), true);
  const rootAssets = readdirSync(join(compatibilityRoot, "assets"));
  assert.equal(rootAssets.some((name) => name.startsWith("StorefrontApp-") && name.endsWith(".js")), true);
  assert.equal(rootAssets.some((name) => name.startsWith("PortalApp-") && name.endsWith(".js")), true);
});

test("storefront and admin builds emit independent browser graphs", () => {
  const storefrontScripts = walk(storefrontRoot)
    .filter((path) => path.endsWith(".js"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const adminScripts = walk(adminRoot)
    .filter((path) => path.endsWith(".js"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  assert.doesNotMatch(storefrontScripts, /\/api\/admin\/inventory/);
  assert.doesNotMatch(storefrontScripts, /InventoryManagementProvider/);
  assert.doesNotMatch(adminScripts, /js\.paystack\.co/);
  assert.doesNotMatch(adminScripts, /ProductInquiryForm/);
});

test("storefront route shells contain route-specific SEO and safe indexing", () => {
  const home = read(storefrontRoot, "index.html");
  const shop = read(storefrontRoot, "shop/index.html");
  const checkout = read(storefrontRoot, "checkout/index.html");
  const sitemap = read(storefrontRoot, "sitemap.xml");

  assert.match(home, /<title>Stroane \| Food Safety Advisory/);
  assert.match(home, /"@type":"Organization"/);
  assert.match(shop, /rel="canonical" href="https:\/\/stroanesolutions\.com\/shop"/);
  assert.match(checkout, /name="robots" content="noindex, nofollow"/);
  assert.doesNotMatch(sitemap, /\/checkout/);
  assert.match(sitemap, /\/products\//);
});

test("admin output is private-by-indexing-policy and has an admin-only CSP", () => {
  const index = read(adminRoot, "index.html");
  assert.match(index, /<title>Stroane Admin<\/title>/);
  assert.match(index, /name="robots" content="noindex, nofollow"/);
  assert.equal(read(adminRoot, "robots.txt"), "User-agent: *\nDisallow: /\n");
  assert.equal(existsSync(join(adminRoot, "sitemap.xml")), false);
  assert.equal(existsSync(join(storefrontRoot, "stroane-portal-sw.js")), false);
  const headers = read(adminRoot, "_headers");
  assert.match(headers, /X-Robots-Tag: noindex, nofollow/);
  assert.doesNotMatch(headers, /paystack/i);
  assert.doesNotMatch(headers, /googletagmanager/i);
});
