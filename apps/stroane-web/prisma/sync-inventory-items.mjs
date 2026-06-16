/**
 * Bootstraps missing operational inventory rows from the active catalogue.
 *
 * The command is dry-run by default. Existing inventory records are never
 * overwritten and unknown stock quantities remain null until staff record a
 * physical count or restock movement.
 *
 * Usage:
 *   APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory
 *   APP_ENV=production pnpm --filter @faako/stroane-web run db:sync:inventory:apply
 */

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const cataloguePath = path.join(appRoot, "src/data/stroaneCatalogue.json");
const catalogue = JSON.parse(readFileSync(cataloguePath, "utf8"));
const localProductBySlug = new Map(
  catalogue.products.flatMap((product) => [
    [product.id, product],
    [product.slug || product.id, product],
  ])
);
dotenv.config({ path: path.join(appRoot, ".env") });

const envName = String(process.env.APP_ENV || process.env.NODE_ENV || "development")
  .trim()
  .toLowerCase();
dotenv.config({ path: path.join(appRoot, `.env.${envName}`), override: true });

const resolveDatabaseUrl = () => {
  if (envName === "production") {
    return process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL;
  }

  return process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;
};

const applyChanges =
  String(process.env.STROANE_INVENTORY_BOOTSTRAP_APPLY || "").trim().toLowerCase() === "true";

const calculateAvailableQuantity = (quantityOnHand, reservedQuantity) => {
  if (quantityOnHand == null) return null;
  return Math.max(0, quantityOnHand - (reservedQuantity ?? 0));
};

const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const makeInventoryKey = (productSlug, variantId = null) =>
  `${productSlug}:${variantId || "__base__"}`;

const getInventoryPlanData = (product, variant = null) => {
  const quantityOnHand = variant
    ? toNullableInteger(variant.stockQuantity)
    : toNullableInteger(product.stockQuantity);
  const reservedQuantity = variant
    ? toNullableInteger(variant.reservedQuantity) ?? 0
    : toNullableInteger(product.reservedQuantity) ?? 0;
  const storedAvailableQuantity = variant
    ? toNullableInteger(variant.availableQuantity)
    : toNullableInteger(product.availableQuantity);
  const availableQuantity =
    storedAvailableQuantity ?? calculateAvailableQuantity(quantityOnHand, reservedQuantity);

  return {
    productId: product.id,
    productSlug: product.slug,
    variantId: variant?.id || null,
    sku: variant?.sku || product.sku,
    quantityOnHand,
    reservedQuantity,
    availableQuantity,
    reorderThreshold: variant
      ? toNullableInteger(variant.reorderThreshold) ?? toNullableInteger(product.reorderThreshold)
      : toNullableInteger(product.reorderThreshold),
    lowStockThreshold: variant
      ? toNullableInteger(variant.lowStockThreshold) ?? toNullableInteger(product.lowStockThreshold)
      : toNullableInteger(product.lowStockThreshold),
    stockStatus: variant?.stockStatus || product.stockStatus || "unavailable",
    inventoryTrackingEnabled: true,
    allowBackorder: variant
      ? Boolean(variant.allowBackorder ?? product.allowBackorder)
      : product.allowBackorder,
    isPurchasable: variant
      ? Boolean(variant.isPurchasable ?? product.isPurchasable)
      : product.isPurchasable,
    notes: variant
      ? "Initial variant inventory setup. Confirm physical stock before enabling online purchasing."
      : "Initial catalogue inventory setup. Confirm physical stock before enabling online purchasing.",
  };
};

const { PrismaClient } = prismaPkg;
const connectionString = resolveDatabaseUrl();

if (!connectionString) {
  console.error("Missing DATABASE_URL_DEVELOPMENT, DATABASE_URL_PRODUCTION, or DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const run = async () => {
  const products = await prisma.catalogueProduct.findMany({
    where: {
      isPublished: true,
      publishingStatus: "active",
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      stockQuantity: true,
      reservedQuantity: true,
      availableQuantity: true,
      reorderThreshold: true,
      lowStockThreshold: true,
      stockStatus: true,
      allowBackorder: true,
      isPurchasable: true,
    },
    orderBy: { slug: "asc" },
  });
  const existingItems = products.length
    ? await prisma.inventoryItem.findMany({
        where: {
          OR: [
            { productId: { in: products.map((product) => product.id) } },
            { productSlug: { in: products.map((product) => product.slug) } },
          ],
        },
        select: { productSlug: true, variantId: true },
      })
    : [];
  const existingInventoryKeys = new Set(
    existingItems.map((item) => makeInventoryKey(item.productSlug, item.variantId))
  );
  const inventoryPlans = products.flatMap((product) => {
    const localProduct = localProductBySlug.get(product.slug) || {};
    const variants = asArray(localProduct.variants).filter((variant) => variant?.id);

    return [
      { product, variant: null },
      ...variants.map((variant) => ({ product, variant })),
    ];
  });
  const missingInventoryPlans = inventoryPlans.filter(
    ({ product, variant }) => !existingInventoryKeys.has(makeInventoryKey(product.slug, variant?.id))
  );
  const missingVariantCount = missingInventoryPlans.filter((plan) => plan.variant).length;
  const missingBaseCount = missingInventoryPlans.length - missingVariantCount;

  console.log(
    `Inventory bootstrap plan: ${products.length} active catalogue product(s), ${existingItems.length} existing inventory row(s), ${missingBaseCount} missing base row(s), ${missingVariantCount} missing variant row(s).`
  );

  if (!applyChanges) {
    console.log("Dry run only. Use db:sync:inventory:apply after reviewing the target database.");
    return;
  }

  let createdCount = 0;
  for (const { product, variant } of missingInventoryPlans) {
    const created = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.inventoryItem.findFirst({
        where: { productSlug: product.slug, variantId: variant?.id || null },
        select: { id: true },
      });
      if (existing) return false;

      const inventoryData = getInventoryPlanData(product, variant);
      const inventoryItem = await transaction.inventoryItem.create({
        data: inventoryData,
      });

      await transaction.inventoryAuditEntry.create({
        data: {
          inventoryItemId: inventoryItem.id,
          action: "INVENTORY_ITEM_BOOTSTRAPPED",
          entityType: "inventory_item",
          entityId: inventoryItem.id,
          productSlug: product.slug,
          variantId: variant?.id || null,
          afterState: {
            variantId: inventoryItem.variantId,
            stockStatus: inventoryItem.stockStatus,
            quantityOnHand: inventoryItem.quantityOnHand,
            reservedQuantity: inventoryItem.reservedQuantity,
            availableQuantity: inventoryItem.availableQuantity,
          },
          note: "Initial inventory record created from active catalogue. Physical count still requires confirmation.",
        },
      });

      return true;
    });

    if (created) createdCount += 1;
  }

  console.log(`Inventory bootstrap complete. Created ${createdCount} inventory row(s).`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
