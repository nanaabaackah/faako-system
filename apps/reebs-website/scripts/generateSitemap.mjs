import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const publicSitemapPath = path.join(appRoot, "public", "sitemap.xml");
const rentalItemsPath = path.join(appRoot, "src", "data", "rentalItems.json");

const SITE_URL = "https://www.reebspartythemes.com";
const today = new Date().toISOString().slice(0, 10);

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

const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const xmlEscape = (value = "") =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildRentalPath = (item = {}) => {
  const idSlug = String(item?.id || item?.productId || "").trim().toLowerCase();
  const pageSlug = slugify(item?.page?.split("/").filter(Boolean).pop() || "");
  const nameSlug = slugify(item?.name);
  const slug = pageSlug || idSlug || nameSlug;
  return slug ? `/rentals/${slug}` : null;
};

const loadRentalRoutes = async () => {
  const raw = await readFile(rentalItemsPath, "utf8");
  const items = JSON.parse(raw);
  const uniquePaths = new Set();

  for (const item of Array.isArray(items) ? items : []) {
    const routePath = buildRentalPath(item);
    if (!routePath) continue;
    uniquePaths.add(routePath);
  }

  return Array.from(uniquePaths)
    .sort((a, b) => a.localeCompare(b))
    .map((routePath) => ({
      path: routePath,
      changefreq: "weekly",
      priority: "0.85",
    }));
};

const buildUrlNode = ({ path: routePath, changefreq, priority }) => {
  const loc = `${SITE_URL}${routePath === "/" ? "" : routePath}`;
  return `  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

const main = async () => {
  const rentalRoutes = await loadRentalRoutes();
  const routes = [...staticRoutes, ...rentalRoutes];
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map(buildUrlNode),
    "</urlset>",
    "",
  ].join("\n");

  await writeFile(publicSitemapPath, sitemap, "utf8");
  console.log(`Generated sitemap with ${routes.length} URLs at ${publicSitemapPath}`);
};

main().catch((error) => {
  console.error("Failed to generate sitemap:", error);
  process.exitCode = 1;
});
