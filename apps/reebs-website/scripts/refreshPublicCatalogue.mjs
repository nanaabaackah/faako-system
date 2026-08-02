import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isOnlineShopItem,
  isTestCategoryItem,
} from "../src/utils/frontendInventoryFilters.js";
import {
  getFrontendRentalCategory,
  getFrontendRentalDetailSlug,
  isFrontendRentalBookable,
  isFrontendRentalItem,
  shouldExcludeFrontendRental,
  slugifyRentalValue,
} from "../src/utils/rentalCatalog.js";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cataloguePath = path.join(appRoot, "src", "content", "public-catalogue.json");
const defaultApiBaseUrl = "https://api.reebspartythemes.com";

const normalizeApiBaseUrl = (value = "") => {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized;
};

const getApiBaseUrl = () =>
  normalizeApiBaseUrl(
    process.env.REEBS_API_BASE_URL
      || process.env.BACKEND_BASE_URL
      || process.env.VITE_API_BASE_URL
      || process.env.VITE_BACKEND_BASE_URL
      || defaultApiBaseUrl,
  );

const asText = (value) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";

const asPrice = (item) => {
  const raw =
    item?.price
    ?? (typeof item?.priceCents === "number" ? item.priceCents / 100 : null);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const imageFor = (item) =>
  asText(item?.imageUrl || item?.image || item?.photo || item?.thumbnail);

const categoryForShop = (item) =>
  asText(
    item?.specificCategory
      || item?.specificcategory
      || item?.inventoryCategory
      || item?.category
      || "Other",
  );

const safeVariants = (item) =>
  (Array.isArray(item?.variants) ? item.variants : [])
    .filter((variant) => String(variant?.status || "active").toLowerCase() === "active")
    .map((variant) => ({
      id: Number(variant?.id) || null,
      sku: asText(variant?.sku),
      name: asText(variant?.variantName),
      number: asText(variant?.variantNumber),
      color: asText(variant?.color),
      size: asText(variant?.size),
      price: Number.isFinite(Number(variant?.priceOverride))
        ? Number(variant.priceOverride)
        : null,
    }));

const uniqueSlug = (candidate, item, usedSlugs) => {
  const base = slugifyRentalValue(candidate) || asText(item?.id || item?.productId);
  let slug = base || "item";
  if (usedSlugs.has(slug)) {
    slug = `${slug}-${asText(item?.id || item?.productId || usedSlugs.size + 1)}`;
  }
  usedSlugs.add(slug);
  return slug;
};

const sanitizeItem = (item, kind, usedSlugs) => {
  const name = asText(item?.name) || "Catalogue item";
  const slug =
    kind === "rental"
      ? uniqueSlug(getFrontendRentalDetailSlug(item), item, usedSlugs)
      : uniqueSlug(name, item, usedSlugs);
  const category =
    kind === "rental" ? getFrontendRentalCategory(item) : categoryForShop(item);
  const id = Number(item?.id ?? item?.productId) || null;

  return {
    id,
    sku: asText(item?.sku),
    kind,
    slug,
    path: `/${kind === "rental" ? "rentals" : "shop"}/${slug}`,
    legacyPaths:
      kind === "rental" && id && String(id) !== slug
        ? [`/rentals/${id}`]
        : [],
    name,
    description: asText(item?.description),
    category,
    categorySlug: slugifyRentalValue(category) || "other",
    price: asPrice(item),
    currency: asText(item?.currency) || "GHS",
    image: imageFor(item),
    availability:
      kind === "rental"
        ? (isFrontendRentalBookable(item) ? "check-date" : "unavailable")
        : (Number(item?.quantity ?? item?.stock ?? 0) > 0 ? "in-stock" : "out-of-stock"),
    variants: safeVariants(item),
  };
};

const sortItems = (left, right) =>
  left.category.localeCompare(right.category)
  || left.name.localeCompare(right.name)
  || left.path.localeCompare(right.path);

const main = async () => {
  const response = await fetch(new URL("/api/inventory", getApiBaseUrl()));
  if (!response.ok) {
    throw new Error(`Inventory request failed: ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new TypeError("Inventory response must be an array");
  }

  const visible = data.filter((item) => !isTestCategoryItem(item));
  const rentalSlugs = new Set();
  const shopSlugs = new Set();
  const rentals = visible
    .filter(
      (item) =>
        isFrontendRentalItem(item)
        && isFrontendRentalBookable(item)
        && !shouldExcludeFrontendRental(item),
    )
    .map((item) => sanitizeItem(item, "rental", rentalSlugs))
    .sort(sortItems);
  const shop = visible
    .filter((item) => isOnlineShopItem(item))
    .map((item) => sanitizeItem(item, "shop", shopSlugs))
    .sort(sortItems);

  const snapshot = {
    schemaVersion: 1,
    source: "/api/inventory",
    rentals,
    shop,
  };

  await writeFile(cataloguePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    `Refreshed public catalogue snapshot with ${rentals.length} rentals and ${shop.length} shop items`,
  );
};

main().catch((error) => {
  console.error("Failed to refresh public catalogue snapshot:", error);
  process.exitCode = 1;
});
