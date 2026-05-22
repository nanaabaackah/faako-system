/**
 * Seeds the Stroane catalogue foundation from src/data/stroaneCatalogue.json.
 *
 * Usage:
 *   APP_ENV=development pnpm --filter @faako/stroane-web run db:seed:catalogue
 *
 * This is a catalogue/import helper only. It does not create orders, payments,
 * inventory automation, CRM records, or notifications.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import prismaPkg from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
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

const normalizeStockStatus = (stock = "") => {
  const normalized = String(stock || "unavailable")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (normalized === "pre_order") return "preorder";
  if (normalized === "price_required" || normalized === "quote_required" || normalized === "manual_review") {
    return "unavailable";
  }
  if (["in_stock", "low_stock", "out_of_stock", "preorder", "unavailable"].includes(normalized)) {
    return normalized;
  }

  return "unavailable";
};

const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
};

const isSeedPurchasable = (product) => {
  if (!product.isPurchasable || product.quoteOnly || product.price == null) return false;

  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  const stockQuantity = toNullableInteger(product.stockQuantity);

  if (stockStatus === "out_of_stock" || stockStatus === "unavailable") return false;
  if (stockStatus === "preorder") return Boolean(product.allowBackorder);

  return stockQuantity != null && stockQuantity > 0;
};

const { PrismaClient } = prismaPkg;
const connectionString = resolveDatabaseUrl();

if (!connectionString) {
  console.error("Missing DATABASE_URL_DEVELOPMENT, DATABASE_URL_PRODUCTION, or DATABASE_URL.");
  process.exit(1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const cataloguePath = path.join(appRoot, "src", "data", "stroaneCatalogue.json");
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, "utf8"));

const run = async () => {
  console.log(
    `Seeding ${catalogue.categories.length} category record(s) and ${catalogue.products.length} product record(s).`
  );

  await prisma.businessProfileContent.upsert({
    where: { key: "business_profile" },
    update: { value: catalogue.businessProfile, isPublic: true },
    create: { key: "business_profile", value: catalogue.businessProfile, isPublic: true },
  });

  for (const [index, category] of catalogue.categories.entries()) {
    const sortOrder = Number.isInteger(category.sortOrder) ? category.sortOrder : index;

    await prisma.catalogueCategory.upsert({
      where: { slug: category.id },
      update: {
        name: category.name,
        description: category.description || null,
        tags: category.tags || [],
        sortOrder,
        isActive: true,
      },
      create: {
        slug: category.id,
        name: category.name,
        description: category.description || null,
        tags: category.tags || [],
        sortOrder,
        isActive: true,
      },
    });
  }

  for (const product of catalogue.products) {
    await prisma.catalogueProduct.upsert({
      where: { slug: product.id },
      update: {
        name: product.name,
        categorySlug: product.categorySlug || null,
        subcategory: product.subcategory || null,
        brand: product.brand || null,
        sku: product.sku || null,
        shortDescription: product.description || null,
        longDescription: product.longDescription || null,
        price: product.price,
        priceLabel: product.priceLabel || null,
        currency: product.currency || "GHS",
        unit: product.unit || null,
        image: product.image || null,
        images: product.images || [],
        tag: product.tag || null,
        stockStatus: normalizeStockStatus(product.stockStatus || product.stock),
        stockQuantity: toNullableInteger(product.stockQuantity),
        lowStockThreshold: toNullableInteger(product.lowStockThreshold),
        allowBackorder: Boolean(product.allowBackorder),
        isPurchasable: isSeedPurchasable(product),
        availability: product.availability || null,
        quoteOnly: Boolean(product.quoteOnly || product.price == null),
        features: product.features || [],
        specifications: product.specifications || {},
        tags: product.tags || [],
        useCases: product.useCases || [],
        inquiryCta: product.inquiryCta || null,
        sourceRefs: product.sourceRefs || [],
        isPublished: true,
        manualReviewRequired: Boolean(
          product.quoteOnly || product.price == null || product.stockQuantity == null || !product.isPurchasable
        ),
      },
      create: {
        slug: product.id,
        name: product.name,
        categorySlug: product.categorySlug || null,
        subcategory: product.subcategory || null,
        brand: product.brand || null,
        sku: product.sku || null,
        shortDescription: product.description || null,
        longDescription: product.longDescription || null,
        price: product.price,
        priceLabel: product.priceLabel || null,
        currency: product.currency || "GHS",
        unit: product.unit || null,
        image: product.image || null,
        images: product.images || [],
        tag: product.tag || null,
        stockStatus: normalizeStockStatus(product.stockStatus || product.stock),
        stockQuantity: toNullableInteger(product.stockQuantity),
        lowStockThreshold: toNullableInteger(product.lowStockThreshold),
        allowBackorder: Boolean(product.allowBackorder),
        isPurchasable: isSeedPurchasable(product),
        availability: product.availability || null,
        quoteOnly: Boolean(product.quoteOnly || product.price == null),
        features: product.features || [],
        specifications: product.specifications || {},
        tags: product.tags || [],
        useCases: product.useCases || [],
        inquiryCta: product.inquiryCta || null,
        sourceRefs: product.sourceRefs || [],
        isPublished: true,
        manualReviewRequired: Boolean(
          product.quoteOnly || product.price == null || product.stockQuantity == null || !product.isPurchasable
        ),
      },
    });
  }

  console.log("Catalogue seed complete.");
};

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
