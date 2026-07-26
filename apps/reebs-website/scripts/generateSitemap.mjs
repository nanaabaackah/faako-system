import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicSitemapPath = path.join(appRoot, "public", "sitemap.xml");
const rentalRoutesPath = path.join(appRoot, "sitemap-rental-routes.json");
const siteUrl = "https://www.reebspartythemes.com";

const staticRoutes = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.8" },
  { path: "/rentals", changefreq: "weekly", priority: "0.95" },
  { path: "/shop", changefreq: "weekly", priority: "0.95" },
  { path: "/contact", changefreq: "monthly", priority: "0.8" },
  { path: "/faq", changefreq: "monthly", priority: "0.75" },
  { path: "/book", changefreq: "weekly", priority: "0.9" },
  { path: "/privacy-policy", changefreq: "yearly", priority: "0.5" },
  { path: "/refund-policy", changefreq: "yearly", priority: "0.5" },
  { path: "/delivery-policy", changefreq: "yearly", priority: "0.5" },
  { path: "/terms-of-service", changefreq: "yearly", priority: "0.5" },
];

const xmlEscape = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const readRentalRoutes = async () => {
  const rawRoutes = JSON.parse(await readFile(rentalRoutesPath, "utf8"));
  if (!Array.isArray(rawRoutes)) {
    throw new TypeError("sitemap-rental-routes.json must contain an array");
  }

  return Array.from(
    new Set(
      rawRoutes.map((routePath) => String(routePath || "").trim())
        .filter((routePath) => /^\/rentals\/[a-z0-9-]+$/.test(routePath))
    )
  ).sort((a, b) => a.localeCompare(b));
};

const buildUrlNode = ({ path: routePath, changefreq, priority }) => {
  const location = `${siteUrl}${routePath === "/" ? "" : routePath}`;
  return `  <url>
    <loc>${xmlEscape(location)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

const createSitemap = async () => {
  const rentalRoutes = (await readRentalRoutes()).map((routePath) => ({
    path: routePath,
    changefreq: "weekly",
    priority: "0.85",
  }));
  const routes = [...staticRoutes, ...rentalRoutes];

  return {
    routeCount: routes.length,
    sitemap: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...routes.map(buildUrlNode),
      "</urlset>",
      "",
    ].join("\n"),
  };
};

const main = async () => {
  const { routeCount, sitemap } = await createSitemap();
  const checkOnly = process.argv.includes("--check");
  const currentSitemap = await readFile(publicSitemapPath, "utf8").catch(() => "");

  if (checkOnly) {
    if (currentSitemap !== sitemap) {
      throw new Error("public/sitemap.xml is stale; run pnpm sitemap");
    }
    console.log(`Sitemap is deterministic and current (${routeCount} URLs)`);
    return;
  }

  if (currentSitemap !== sitemap) {
    await writeFile(publicSitemapPath, sitemap, "utf8");
    console.log(`Generated deterministic sitemap with ${routeCount} URLs`);
    return;
  }

  console.log(`Sitemap already current (${routeCount} URLs)`);
};

main().catch((error) => {
  console.error("Failed to generate sitemap:", error);
  process.exitCode = 1;
});
