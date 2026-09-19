import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appRoot = new URL("..", import.meta.url).pathname;
const distRoot = join(appRoot, "dist");
const siteUrl = "https://www.reebspartythemes.com";
const catalogue = JSON.parse(
  readFileSync(join(appRoot, "src", "content", "public-catalogue.json"), "utf8"),
);

const routeFile = (route) => {
  if (route === "/") return join(distRoot, "index.html");
  if (route === "/404" || route === "/500") return join(distRoot, `${route.slice(1)}.html`);
  return join(distRoot, route.slice(1), "index.html");
};
const readRoute = (route) => readFileSync(routeFile(route), "utf8");
const meta = (html, name) =>
  html.match(new RegExp(`<meta\\s+name=["']${name}["']\\s+content=["']([^"']*)`, "i"))?.[1];
const canonical = (html) =>
  html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)/i)?.[1];
const schemas = (html) => {
  const payloads = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];
  return payloads.flatMap((match) => JSON.parse(match[1]));
};
const schemaTypes = (html) => new Set(schemas(html).map((entry) => entry?.["@type"]));

test("primary public routes have server-rendered metadata, canonical URLs, and one H1", () => {
  const routes = [
    "/",
    "/about",
    "/book",
    "/contact",
    "/delivery-policy",
    "/faq",
    "/privacy-policy",
    "/refund-policy",
    "/rentals",
    "/shop",
    "/terms-of-service",
  ];

  for (const route of routes) {
    const html = readRoute(route);
    assert.match(html, /<title>[^<]{8,}<\/title>/i, `${route} title`);
    assert.ok(meta(html, "description")?.length >= 40, `${route} description`);
    assert.equal(meta(html, "robots"), "index, follow", `${route} robots`);
    assert.equal(canonical(html), route === "/" ? `${siteUrl}/` : `${siteUrl}${route}`);
    assert.match(html, /<meta property="og:title"/i, `${route} Open Graph`);
    assert.match(html, /<meta name="twitter:card"/i, `${route} Twitter card`);
    assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${route} H1 count`);
  }
});

test("transactional, authentication, and status routes are noindex", () => {
  for (const route of ["/404", "/500", "/cart", "/checkout", "/customer-login", "/reset-password"]) {
    const html = readRoute(route);
    assert.equal(meta(html, "robots"), "noindex, nofollow", `${route} robots`);
  }
});

test("catalogue detail routes render durable content and truthful structured data", () => {
  const rental = catalogue.rentals[0];
  const shop = catalogue.shop.find((item) => item.price > 0 && item.image) || catalogue.shop[0];

  for (const item of [rental, shop]) {
    const html = readRoute(item.path);
    assert.match(html, new RegExp(`<h1[^>]*>[^<]*${item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
    assert.equal(canonical(html), `${siteUrl}${item.path}`);
    const entries = schemas(html);
    const product = entries.find((entry) => entry?.["@type"] === "Product");
    assert.ok(product, `${item.path} Product schema`);
    assert.equal(product.name, item.name);
    assert.equal(product.sku, item.sku || undefined);
    assert.ok(entries.some((entry) => entry?.["@type"] === "BreadcrumbList"));
    assert.match(html, new RegExp(`/category/${item.categorySlug}`));
    if (item.kind === "rental" && product.offers) {
      assert.equal(
        product.offers.businessFunction,
        "http://purl.org/goodrelations/v1#LeaseOut",
      );
      assert.equal(product.offers.availability, undefined);
    }
  }
});

test("organization, website, FAQ, and breadcrumb entities match rendered pages", () => {
  const homeTypes = schemaTypes(readRoute("/"));
  assert.ok(homeTypes.has("Organization"));
  assert.ok(homeTypes.has("PartySupplyStore"));
  assert.ok(homeTypes.has("WebSite"));
  assert.ok(homeTypes.has("BreadcrumbList"));

  const faqHtml = readRoute("/faq");
  const faq = schemas(faqHtml).find(
    (entry) => entry?.["@type"] === "FAQPage" && entry?.mainEntity,
  );
  assert.ok(faq?.mainEntity?.length > 0);
  for (const question of faq.mainEntity) {
    assert.ok(faqHtml.includes(question.name), `visible FAQ question: ${question.name}`);
    assert.ok(faqHtml.includes(question.acceptedAnswer.text), `visible FAQ answer: ${question.name}`);
  }
});

test("homepage does not publish unsupported customer stories or age claims", () => {
  const html = readRoute("/");
  assert.doesNotMatch(html, /Ama|Kwame|Nana Mensah/);
  assert.doesNotMatch(html, /20\+\s*years/i);
});

test("sitemap includes canonical public catalogue routes and excludes private flows", () => {
  const index = readFileSync(join(distRoot, "sitemap-index.xml"), "utf8");
  const sitemap = readFileSync(join(distRoot, "sitemap-0.xml"), "utf8");
  assert.match(index, /sitemap-0\.xml/);
  for (const path of [
    "/about",
    "/book",
    "/faq",
    "/rentals",
    "/shop",
    catalogue.rentals[0].path,
    catalogue.shop[0].path,
  ]) {
    assert.ok(sitemap.includes(`<loc>${siteUrl}${path}</loc>`), path);
  }
  for (const path of ["/cart", "/checkout", "/customer-login", "/reset-password", "/404", "/500"]) {
    assert.ok(!sitemap.includes(`<loc>${siteUrl}${path}</loc>`), path);
  }
});

test("public catalogue snapshot contains only the approved storefront field set", () => {
  const allowed = new Set([
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
  const forbidden = /cost|margin|markup|supplier|internalnote|watercost|purchaseprice/i;
  for (const item of [...catalogue.rentals, ...catalogue.shop]) {
    for (const key of Object.keys(item)) {
      assert.ok(allowed.has(key), `unexpected public field: ${key}`);
      assert.doesNotMatch(key, forbidden);
    }
  }
  assert.doesNotMatch(JSON.stringify(catalogue), /"(?:costPrice|margin|supplierCost|internalNotes)"\s*:/i);
});

test("redirect and robots output does not restore the obsolete SPA fallback", () => {
  const redirects = readFileSync(join(distRoot, "_redirects"), "utf8");
  const robots = readFileSync(join(distRoot, "robots.txt"), "utf8");
  assert.doesNotMatch(redirects, /\/\*\s+\/index\.html\s+200/);
  assert.match(redirects, /\/Shop\s+\/shop\s+301/);
  assert.match(redirects, /\/Rentals\s+\/rentals\s+301/);
  assert.match(robots, /Disallow: \/checkout/);
  assert.match(robots, /Disallow: \/reset-password/);
  assert.match(robots, /Sitemap: https:\/\/www\.reebspartythemes\.com\/sitemap-index\.xml/);
});
