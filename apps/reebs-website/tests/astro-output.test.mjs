import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appRoot = new URL("..", import.meta.url).pathname;
const distRoot = join(appRoot, "dist");
const catalogue = JSON.parse(
  readFileSync(join(appRoot, "src", "content", "public-catalogue.json"), "utf8"),
);
const sampleRental = catalogue.rentals[0];
const sampleShopItem = catalogue.shop[0];
const sampleShopCategory = sampleShopItem.categorySlug;

const htmlPathForRoute = (route) =>
  route === "/"
    ? join(distRoot, "index.html")
    : join(distRoot, route, "index.html");

const publicRoutes = [
  "/",
  "/about",
  "/book",
  "/contact",
  "/delivery-policy",
  "/faq",
  "/privacy-policy",
  "/refund-policy",
  "/rentals",
  `/rentals/category/${sampleRental.categorySlug}`,
  sampleRental.path,
  "/shop",
  `/shop/category/${sampleShopCategory}`,
  sampleShopItem.path,
  "/terms-of-service",
];

test("public routes are pre-rendered with complete metadata and one initial h1", () => {
  for (const route of publicRoutes) {
    const outputPath = htmlPathForRoute(route);
    assert.ok(existsSync(outputPath), `missing output for ${route}`);
    const html = readFileSync(outputPath, "utf8");

    assert.match(html, /<title>[^<]+<\/title>/, `missing title for ${route}`);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(
      html,
      /<link rel="canonical" href="https:\/\/www\.reebspartythemes\.com\//,
    );
    assert.match(html, /<meta property="og:title" content="[^"]+"/);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image"/);
    assert.match(html, /<script type="application\/ld\+json">/);
    assert.equal(
      (html.match(/<h1\b/g) || []).length,
      1,
      `expected one initial h1 for ${route}`,
    );
    assert.ok(
      html.includes('content="index, follow"'),
      `wrong robots directive for ${route}`,
    );
  }
});

test("transactional routes and status pages are noindex", () => {
  for (const route of ["/cart", "/checkout", "/customer-login", "/reset-password"]) {
    const html = readFileSync(htmlPathForRoute(route), "utf8");
    assert.ok(html.includes('content="noindex, nofollow"'), route);
  }
  for (const file of ["404.html", "500.html"]) {
    const html = readFileSync(join(distRoot, file), "utf8");
    assert.ok(html.includes('content="noindex, nofollow"'), file);
  }
});

test("Astro sitemap, robots, redirects, and CSP agree with the deployment contract", () => {
  const sitemap = readFileSync(join(distRoot, "sitemap-0.xml"), "utf8");
  const robots = readFileSync(join(distRoot, "robots.txt"), "utf8");
  const redirects = readFileSync(join(distRoot, "_redirects"), "utf8");
  const headers = readFileSync(join(distRoot, "_headers"), "utf8");

  assert.ok(sitemap.includes("www.reebspartythemes.com/shop<"));
  assert.ok(sitemap.includes(`www.reebspartythemes.com${sampleRental.path}<`));
  assert.ok(!sitemap.includes("www.reebspartythemes.com/cart<"));
  assert.ok(!sitemap.includes("/Shop/"));
  assert.match(
    robots,
    /Sitemap: https:\/\/www\.reebspartythemes\.com\/sitemap-index\.xml/,
  );
  assert.ok(!redirects.includes("index.html 200"), "SPA fallback must not remain");
  assert.ok(redirects.includes("/login https://portal.reebspartythemes.com/login 302"));
  assert.ok(
    redirects.includes(
      `${sampleRental.legacyPaths[0]} ${sampleRental.path} 301`,
    ),
  );
  assert.ok(!headers.includes("__ASTRO_SCRIPT_HASHES__"));
  assert.ok(headers.length < 24_000, "CSP header is too large for a static host");
});

test("catalogue snapshot is public-only and the public manifest has no backend ownership", () => {
  const allowedItemKeys = new Set([
    "id",
    "sku",
    "kind",
    "slug",
    "path",
    "legacyPaths",
    "name",
    "description",
    "category",
    "categorySlug",
    "price",
    "currency",
    "image",
    "availability",
    "variants",
  ]);
  for (const item of [...catalogue.rentals, ...catalogue.shop]) {
    Object.keys(item).forEach((key) => {
      assert.ok(allowedItemKeys.has(key), `unexpected public catalogue field ${key}`);
    });
  }

  const manifest = JSON.parse(readFileSync(join(appRoot, "package.json"), "utf8"));
  for (const backendPackage of [
    "@prisma/client",
    "@prisma/adapter-pg",
    "express",
    "nodemailer",
    "pg",
    "prisma",
    "railway",
  ]) {
    assert.equal(manifest.dependencies?.[backendPackage], undefined, backendPackage);
    assert.equal(manifest.devDependencies?.[backendPackage], undefined, backendPackage);
  }
});
