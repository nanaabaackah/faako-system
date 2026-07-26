import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rentalRoutesPath = path.join(appRoot, "sitemap-rental-routes.json");
const defaultApiBaseUrl = "https://api.reebspartythemes.com";

const slugify = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

const buildRentalPath = (item = {}) => {
  const idSlug = String(item?.id || item?.productId || "").trim().toLowerCase();
  const pageSlug = slugify(item?.page?.split("/").filter(Boolean).pop() || "");
  const nameSlug = slugify(item?.name);
  const slug = pageSlug || idSlug || nameSlug;
  return slug ? `/rentals/${slug}` : null;
};

const normalizeApiBaseUrl = (value = "") => {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized;
};

const getApiBaseUrl = () =>
  normalizeApiBaseUrl(
    process.env.VITE_API_BASE_URL
      || process.env.REEBS_API_BASE_URL
      || process.env.BACKEND_BASE_URL
      || process.env.VITE_BACKEND_BASE_URL
      || defaultApiBaseUrl
  );

const isRentalInventoryItem = (item = {}) => {
  const source = String(
    item.sourceCategoryCode
      || item.sourcecategorycode
      || item.sourceCategoryName
      || item.sourcecategoryname
      || ""
  ).trim().toLowerCase();

  if (source === "rental" || source === "rentals") return true;
  return String(item.sku || "").trim().toUpperCase().startsWith("REN");
};

const main = async () => {
  const response = await fetch(new URL("/api/inventory", getApiBaseUrl()));
  if (!response.ok) {
    throw new Error(`Inventory request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new TypeError("Inventory response must be an array");
  }

  const routes = Array.from(
    new Set(
      data.filter(isRentalInventoryItem)
        .map(buildRentalPath)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  await writeFile(rentalRoutesPath, `${JSON.stringify(routes, null, 2)}\n`, "utf8");
  console.log(`Refreshed the committed sitemap snapshot with ${routes.length} rental routes`);
};

main().catch((error) => {
  console.error("Failed to refresh rental sitemap routes:", error);
  process.exitCode = 1;
});
