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
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
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
          productId: { in: products.map((product) => product.id) },
          variantId: null,
        },
        select: { productId: true },
      })
    : [];
  const existingProductIds = new Set(existingItems.map((item) => item.productId));
  const missingProducts = products.filter((product) => !existingProductIds.has(product.id));

  console.log(
    `Inventory bootstrap plan: ${products.length} active catalogue product(s), ${existingItems.length} existing inventory row(s), ${missingProducts.length} missing inventory row(s).`
  );

  if (!applyChanges) {
    console.log("Dry run only. Use db:sync:inventory:apply after reviewing the target database.");
    return;
  }

  let createdCount = 0;
  for (const product of missingProducts) {
    const created = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.inventoryItem.findFirst({
        where: { productId: product.id, variantId: null },
        select: { id: true },
      });
      if (existing) return false;

      const reservedQuantity = product.reservedQuantity ?? 0;
      const availableQuantity =
        product.availableQuantity ??
        calculateAvailableQuantity(product.stockQuantity, reservedQuantity);
      const inventoryItem = await transaction.inventoryItem.create({
        data: {
          productId: product.id,
          productSlug: product.slug,
          variantId: null,
          sku: product.sku,
          quantityOnHand: product.stockQuantity,
          reservedQuantity,
          availableQuantity,
          reorderThreshold: product.reorderThreshold,
          lowStockThreshold: product.lowStockThreshold,
          stockStatus: product.stockStatus || "unavailable",
          inventoryTrackingEnabled: true,
          allowBackorder: product.allowBackorder,
          isPurchasable: product.isPurchasable,
          notes:
            "Initial catalogue inventory setup. Confirm physical stock before enabling online purchasing.",
        },
      });

      await transaction.inventoryAuditEntry.create({
        data: {
          inventoryItemId: inventoryItem.id,
          action: "INVENTORY_ITEM_BOOTSTRAPPED",
          entityType: "inventory_item",
          entityId: inventoryItem.id,
          productSlug: product.slug,
          afterState: {
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
