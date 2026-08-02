import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cataloguePath = path.join(appRoot, "src", "content", "public-catalogue.json");
const builtSitemapPath = path.join(appRoot, "dist", "sitemap-0.xml");
const checkOnly = process.argv.includes("--check");
const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
const dynamicPaths = [...(catalogue.rentals || []), ...(catalogue.shop || [])]
  .map((item) => String(item?.path || ""));
const uniquePaths = new Set(dynamicPaths);

if (uniquePaths.size !== dynamicPaths.length) {
  throw new Error("Public catalogue contains duplicate route paths.");
}
if (dynamicPaths.some((routePath) => !/^\/(?:rentals|shop)\/[a-z0-9-]+$/.test(routePath))) {
  throw new Error("Public catalogue contains an invalid route path.");
}

const hasBuiltSitemap = await access(builtSitemapPath).then(() => true).catch(() => false);
if (checkOnly && hasBuiltSitemap) {
  const sitemap = await readFile(builtSitemapPath, "utf8");
  for (const requiredPath of ["/about", "/contact", "/faq", "/rentals", "/shop"]) {
    if (!sitemap.includes(requiredPath)) {
      throw new Error(`Built Astro sitemap is missing ${requiredPath}.`);
    }
  }
}

console.log(
  `Astro sitemap inputs are valid (${dynamicPaths.length} catalogue routes).`
  + (hasBuiltSitemap ? " Built sitemap checked." : " Sitemap will be emitted during build."),
);
