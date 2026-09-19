import { readFile } from "node:fs/promises";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;
const siteUrl = "https://www.reebspartythemes.com";
const catalogue = JSON.parse(
  await readFile(join(appRoot, "src", "content", "public-catalogue.json"), "utf8"),
);
const sitemapIndex = await readFile(join(appRoot, "dist", "sitemap-index.xml"), "utf8");
const sitemap = await readFile(join(appRoot, "dist", "sitemap-0.xml"), "utf8");

if (!sitemapIndex.includes(`${siteUrl}/sitemap-0.xml`)) {
  throw new Error("Sitemap index does not reference the generated child sitemap.");
}

const urls = new Set(
  [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
);
const staticPaths = [
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
const categoryPaths = ["rentals", "shop"].flatMap((kind) =>
  [...new Set((catalogue[kind] || []).map((item) => item.categorySlug).filter(Boolean))]
    .map((slug) => `/${kind}/category/${slug}`),
);
const publicPaths = [
  ...staticPaths,
  ...categoryPaths,
  ...(catalogue.rentals || []).map((item) => item.path),
  ...(catalogue.shop || []).map((item) => item.path),
];
const excludedPaths = [
  "/404",
  "/500",
  "/cart",
  "/checkout",
  "/customer-login",
  "/reset-password",
];
const missing = publicPaths.filter((path) => {
  if (path === "/") return !urls.has(siteUrl) && !urls.has(`${siteUrl}/`);
  return !urls.has(`${siteUrl}${path}`);
});
const incorrectlyIncluded = excludedPaths.filter((path) => urls.has(`${siteUrl}${path}`));

if (missing.length || incorrectlyIncluded.length) {
  throw new Error(
    `Sitemap validation failed. Missing: ${missing.slice(0, 10).join(", ") || "none"}. `
      + `Incorrectly included: ${incorrectlyIncluded.join(", ") || "none"}.`,
  );
}

console.log(
  `Sitemap validation passed: ${urls.size} canonical URLs, `
    + `${publicPaths.length} expected public paths, no transactional paths.`,
);
