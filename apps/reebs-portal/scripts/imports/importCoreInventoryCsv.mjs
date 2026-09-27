#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageDirectory = path.resolve(scriptDirectory, "../..");
const dataDirectory = path.join(packageDirectory, "data");
const APPLY_FLAG = "--apply";
const CONFIRM_FLAG = "--confirm-staging";

const cleanText = (value) => String(value || "").trim();
const normalizeKey = (value) => cleanText(value).toLowerCase();
const normalizeSku = (value) => cleanText(value).toUpperCase();
const formatName = (value) => {
  const normalized = cleanText(value).toLowerCase();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
};
const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const toCents = (value) => {
  const cleaned = String(value || "").replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};
const generateSku = (name, category, index) => {
  const prefix = cleanText(category).slice(0, 3).toUpperCase() || "GEN";
  const cleanName = cleanText(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")
    .slice(0, 10);
  return `${prefix}-${cleanName}-${String(index).padStart(3, "0")}`;
};

const readCsv = (fileName, options = {}) => {
  const filePath = path.join(dataDirectory, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Required CSV is missing: data/${fileName}`);
  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    ...options,
  });
};

const readRawCsv = (fileName, skipLines) => {
  const filePath = path.join(dataDirectory, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Required CSV is missing: data/${fileName}`);
  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
  }).slice(skipLines);
};

const assignClothingCategory = (name) => {
  const value = normalizeKey(name);
  if (value.includes("baby") || value.includes("6m") || value.includes("infant") || value.includes("toddler")) return "Baby Clothing";
  if (value.includes("men") || value.includes("mens") || value.includes("male") || value.includes("boxer")) return "Men's Clothing";
  if (value.includes("women") || value.includes("ladies") || value.includes("dress") || value.includes("heel")) {
    return value.includes("girl") ? "Girl's Clothing" : "Women's Clothing";
  }
  if (value.includes("girl")) return "Girl's Clothing";
  if (value.includes("boy")) return "Boy's Clothing";
  return "General Clothing";
};

const assignShoeCategory = (name) => {
  const value = normalizeKey(name);
  if (value.includes("baby") || value.includes("infant") || value.includes("toddler")) return "Baby Shoes";
  if (value.includes("women") || value.includes("ladies") || value.includes("heel")) return "Women's Shoes";
  if (value.includes("men") || value.includes("mens") || value.includes("male")) return "Men's Shoes";
  if (value.includes("girl")) return "Girls' Shoes";
  if (value.includes("boy")) return "Boys' Shoes";
  return "General Shoes";
};

const assignToyCategory = (name) => {
  const value = normalizeKey(name);
  if (["party", "balloon", "decor", "banner", "cup", "plate"].some((term) => value.includes(term))) return "Party Supplies";
  if (["house", "home", "kitchen", "mop", "broom", "storage"].some((term) => value.includes(term))) return "Household Items";
  if (value.includes("baby") || value.includes("infant") || value.includes("toddler")) return "Baby Toys";
  return "Kids Toys";
};

const normalizeImages = (row) => {
  const raw = cleanText(row?.images);
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(cleanText).filter(Boolean);
    } catch {
      // Fall back to the single image column below.
    }
  }
  return [cleanText(row?.image)].filter(Boolean);
};

const createProduct = (input) => ({
  description: null,
  purchasePriceGbp: null,
  purchasePriceGhs: null,
  saleValue: null,
  currency: "GHS",
  rate: null,
  page: null,
  age: null,
  imageUrl: null,
  attendantsNeeded: null,
  isActive: true,
  relationship: null,
  shopItem: false,
  ...input,
  stockValue: Math.max(0, Number(input.stock || 0)) * Math.max(0, Number(input.price || 0)),
});

export const buildCoreInventoryPlan = () => {
  const products = [];
  const storefrontImages = new Map(
    readCsv("inventory.csv")
      .filter((row) => cleanText(row.name))
      .map((row) => [normalizeKey(row.name), cleanText(row.image_url)])
  );

  const inventorySources = [
    { file: "Inventory - CLOTHES25.csv", code: "CLOTHES", skip: 2, category: assignClothingCategory },
    { file: "Inventory - TOYS25.csv", code: "TOYS", skip: 1, category: assignToyCategory },
    { file: "Inventory - SHOES25.csv", code: "SHOES", skip: 1, category: assignShoeCategory },
  ];

  for (const source of inventorySources) {
    for (const [index, row] of readRawCsv(source.file, source.skip).entries()) {
      const rawName = cleanText(row[1]);
      if (!rawName || rawName.toUpperCase() === "DESCRIPTION") continue;
      const trailingImage = cleanText(row[row.length - 1]);
      products.push(createProduct({
        sku: generateSku(rawName, source.code, index),
        name: formatName(rawName),
        stock: Math.max(0, toInteger(row[5])),
        price: Math.max(0, toCents(row[4])),
        purchasePriceGbp: Math.max(0, toCents(row[2])),
        purchasePriceGhs: Math.max(0, toCents(row[3])),
        saleValue: Math.max(0, toCents(row[19])),
        sourceCategoryCode: source.code,
        specificCategory: source.category(rawName),
        imageUrl: trailingImage.startsWith("/imgs/")
          ? trailingImage
          : storefrontImages.get(normalizeKey(rawName)) || null,
        shopItem: true,
      }));
    }
  }

  const rentalRows = readCsv("rentals.csv");
  const machineRows = [];
  for (const [index, row] of rentalRows.entries()) {
    const rawName = cleanText(row.name);
    if (!rawName) continue;
    const nameKey = normalizeKey(rawName);
    const categoryKey = normalizeKey(row.category);
    const isMachine = ["snow cone", "snowcone", "popcorn", "cotton candy"].some((term) => nameKey.includes(term));
    const isIndoor = nameKey.includes("indoor") || nameKey.includes("board game") || nameKey.includes("jenga");
    if (isMachine) machineRows.push(row);
    if (isMachine || isIndoor || nameKey === "bouncy castle") continue;

    products.push(createProduct({
      sku: generateSku(rawName, "RENTAL", index),
      name: formatName(rawName),
      stock: Math.max(0, toInteger(row.quantity)),
      price: Math.max(0, toCents(row.price)),
      rate: cleanText(row.rate) || "per day",
      page: cleanText(row.page) || null,
      imageUrl: cleanText(row.image) || null,
      sourceCategoryCode: "RENTAL",
      specificCategory: nameKey.includes("bouncy") || categoryKey.includes("bouncy")
        ? "Bouncy Castles"
        : cleanText(row.category) || "Rentals",
      isActive: normalizeKey(row.status) === "available",
      attendantsNeeded: Math.max(0, toInteger(row.attendantsNeeded || row.attendants_needed)),
    }));
  }

  for (const [index, row] of readCsv("vendor_rentals.csv").entries()) {
    const rawName = cleanText(row.name);
    if (!rawName) continue;
    const sourceCode = normalizeSku(row.sourceCategoryCode || "RENTAL");
    if (sourceCode === "WATER") continue;
    products.push(createProduct({
      sku: generateSku(rawName, sourceCode || "RENTAL", index),
      name: formatName(rawName),
      description: cleanText(row.description) || null,
      stock: Math.max(0, toInteger(row.quantity)),
      price: Math.max(0, toCents(row.price)),
      rate: cleanText(row.rate) || null,
      imageUrl: cleanText(row.image_url) || null,
      sourceCategoryCode: sourceCode || "RENTAL",
      specificCategory: cleanText(row.type) || "Party Setup Rentals",
      isActive: normalizeKey(row.status) === "available",
      attendantsNeeded: Math.max(0, toInteger(row.attendantsNeeded || row.attendants_needed)),
    }));
  }

  const combinedMachines = [...machineRows, ...readCsv("motor_pumps.csv")];
  for (const [index, row] of combinedMachines.entries()) {
    const rawName = cleanText(row.name);
    if (!rawName) continue;
    const isPump = normalizeKey(rawName).includes("pump");
    products.push(createProduct({
      sku: generateSku(rawName, isPump ? "PUMP" : "MACH", index),
      name: formatName(rawName),
      stock: Math.max(0, toInteger(row.quantity)),
      price: Math.max(0, toCents(row.price)),
      rate: cleanText(row.rate) || null,
      page: cleanText(row.page) || null,
      imageUrl: cleanText(row.image) || null,
      sourceCategoryCode: "RENTAL",
      specificCategory: "Machines",
      isActive: normalizeKey(row.status || row.availability) !== "unavailable",
      attendantsNeeded: Math.max(0, toInteger(row.attendantsNeeded || row.attendants_needed)),
      relationship: {
        type: "machine",
        availability: cleanText(row.status || row.availability) || null,
        category: cleanText(row.category) || null,
        power: cleanText(row.power) || null,
        notes: cleanText(row.notes) || null,
      },
    }));
  }

  for (const [index, row] of readCsv("bounty_castle.csv").entries()) {
    const rawName = cleanText(row.name);
    if (!rawName) continue;
    const images = normalizeImages(row);
    const capacity = cleanText(row.capacity);
    const motorsToPump = cleanText(row.motorsToPump || row.motors_to_pump || row.motorstopump);
    const bestFor = cleanText(row.bestFor);
    const features = cleanText(row.features);
    const descriptionParts = [
      capacity ? `Capacity: ${capacity}.` : "",
      motorsToPump ? `Motors: ${motorsToPump}.` : "",
      bestFor ? `Best for: ${bestFor}.` : "",
      features ? `Features: ${features}.` : "",
    ].filter(Boolean);
    products.push(createProduct({
      sku: generateSku(rawName, "BOUNCY", index),
      name: rawName,
      description: descriptionParts.length ? `Bouncy Castle. ${descriptionParts.join(" ")}` : "Bouncy Castle.",
      stock: 1,
      price: Math.max(0, toCents(row.price)),
      rate: cleanText(row.rate) || null,
      page: "/Rentals/BouncyCastle",
      age: cleanText(row.recommendedAge || row.recommendedage) || null,
      imageUrl: cleanText(row.image) || images[0] || null,
      sourceCategoryCode: "RENTAL",
      specificCategory: "Bouncy Castles",
      attendantsNeeded: Math.max(0, toInteger(row.attendantsNeeded || row.attendants_needed)),
      relationship: {
        type: "bouncyCastle",
        capacity: capacity || null,
        recommendedAge: cleanText(row.recommendedAge || row.recommendedage) || null,
        priceRange: cleanText(row.price) || null,
        motorsToPump: Number.isFinite(Number(motorsToPump)) ? Number(motorsToPump) : null,
        bestFor: bestFor || null,
        features: features || null,
        images,
      },
    }));
  }

  for (const [index, row] of readCsv("indoor_games.csv").entries()) {
    const rawName = cleanText(row.name);
    if (!rawName) continue;
    const stock = Math.max(0, toInteger(row.quantity));
    const price = Math.max(0, toCents(row.price));
    products.push(createProduct({
      sku: generateSku(rawName, "INDOOR", index),
      name: formatName(rawName),
      stock,
      price,
      rate: cleanText(row.rate) || null,
      page: cleanText(row.page) || null,
      imageUrl: cleanText(row.image) || null,
      sourceCategoryCode: "RENTAL",
      specificCategory: cleanText(row.category) || "Indoor Games",
      isActive: normalizeKey(row.availability) !== "unavailable",
      relationship: {
        type: "indoorGame",
        availability: cleanText(row.availability) || null,
        category: cleanText(row.category) || "Indoor Games",
        piecesTotal: cleanText(row.piecesTotal) ? toInteger(row.piecesTotal) : null,
        piecesMissing: cleanText(row.piecesMissing) ? toInteger(row.piecesMissing) : null,
      },
    }));
  }

  for (const [index, row] of readCsv("inventory.csv").entries()) {
    const rawName = cleanText(row.name);
    if (!rawName) continue;
    products.push(createProduct({
      sku: generateSku(rawName, "SHOP", index),
      name: formatName(rawName),
      description: cleanText(row.description) || null,
      stock: Math.max(0, toInteger(row.quantity)),
      price: Math.max(0, toCents(row.price)),
      currency: cleanText(row.currency) || "GHS",
      imageUrl: cleanText(row.image_url || row.image) || null,
      sourceCategoryCode: "SHOP",
      specificCategory: cleanText(row.type || row.category) || "Shop Items",
      isActive: normalizeKey(row.status) !== "unavailable",
      age: cleanText(row.age_range || row.ageRange) || null,
      shopItem: true,
    }));
  }

  const skuCounts = new Map();
  for (const product of products) {
    const key = normalizeSku(product.sku);
    skuCounts.set(key, (skuCounts.get(key) || 0) + 1);
  }
  const duplicateSkus = [...skuCounts.entries()].filter(([, count]) => count > 1).map(([sku]) => sku);
  const waterProducts = products.filter((product) => normalizeSku(product.sourceCategoryCode) === "WATER");
  if (duplicateSkus.length) throw new Error(`CSV plan contains duplicate SKUs (${duplicateSkus.length}).`);
  if (waterProducts.length) throw new Error("Core Inventory import refused: Water products were found in the plan.");

  return products;
};

const summarize = (products) => {
  const bySource = {};
  const relationships = {};
  let openingStockUnits = 0;
  for (const product of products) {
    bySource[product.sourceCategoryCode] = (bySource[product.sourceCategoryCode] || 0) + 1;
    if (product.relationship?.type) {
      relationships[product.relationship.type] = (relationships[product.relationship.type] || 0) + 1;
    }
    openingStockUnits += product.stock;
  }
  return {
    products: products.length,
    openingStockUnits,
    shopItems: products.filter((product) => product.shopItem).length,
    bySource,
    relationships,
    waterProducts: 0,
  };
};

const insertProduct = async (client, organizationId, product) => {
  const result = await client.query(
    `INSERT INTO "product" (
       "organizationId", sku, name, description, "itemType", "sourceCategoryCode",
       "specificCategory", rate, page, age, "purchasePriceGhs", "purchasePriceGbp",
       "stockValue", "saleValue", price, currency, stock, "isActive", "imageUrl",
       "attendantsNeeded", "lastUpdatedAt", "createdAt", "updatedAt"
     ) VALUES (
       $1,$2,$3,$4,'STANDARD',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW(),NOW()
     )
     ON CONFLICT ("organizationId", sku) DO NOTHING
     RETURNING id`,
    [
      organizationId,
      product.sku,
      product.name,
      product.description,
      product.sourceCategoryCode,
      product.specificCategory,
      product.rate,
      product.page,
      product.age,
      product.purchasePriceGhs,
      product.purchasePriceGbp,
      product.stockValue,
      product.saleValue,
      product.price,
      product.currency,
      product.stock,
      product.isActive,
      product.imageUrl,
      product.attendantsNeeded,
    ]
  );
  if (result.rowCount > 0) return { id: Number(result.rows[0].id), created: true };
  const existing = await client.query(
    `SELECT id FROM "product" WHERE "organizationId" = $1 AND sku = $2 LIMIT 1`,
    [organizationId, product.sku]
  );
  return { id: Number(existing.rows[0]?.id), created: false };
};

const insertOpeningMovement = async (client, organizationId, productId, product) => {
  if (product.stock <= 0) return false;
  const result = await client.query(
    `INSERT INTO "stockMovement" (
       "organizationId", "productId", type, quantity, notes, reference, date,
       "performedByName", "idempotencyKey", "sourceType", "sourceId",
       "previousStock", "resultingStock", "createdAt"
     ) VALUES ($1,$2,'StockIn',$3,$4,'CSV opening stock',NOW(),'Staging CSV import',$5,'CSV_OPENING_STOCK',$6,0,$3,NOW())
     ON CONFLICT ("organizationId", "idempotencyKey") DO NOTHING`,
    [
      organizationId,
      productId,
      product.stock,
      `Opening balance imported from the approved REEBS Core Inventory CSV bundle for ${product.sku}.`,
      `csv-core-inventory-v1:${product.sku}`,
      product.sku,
    ]
  );
  return result.rowCount > 0;
};

const insertRelationship = async (client, organizationId, productId, product) => {
  const relation = product.relationship;
  if (!relation) return false;
  if (relation.type === "machine") {
    const result = await client.query(
      `INSERT INTO machines (
         "organizationId", name, "productId", quantity, price, rate, availability,
         category, image, page, power, notes, "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       ON CONFLICT ("productId") DO NOTHING`,
      [organizationId, product.name, productId, product.stock, product.price, product.rate,
        relation.availability, relation.category, product.imageUrl, product.page, relation.power, relation.notes]
    );
    return result.rowCount > 0;
  }
  if (relation.type === "bouncyCastle") {
    const bouncerId = `BOUN-${String(productId).padStart(6, "0")}`;
    const result = await client.query(
      `INSERT INTO bouncy_castles (
         "organizationId", "bouncerId", name, "productId", capacity, "recommendedAge",
         "priceRange", "motorsToPump", "bestFor", features, image, images, "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       ON CONFLICT ("productId") DO NOTHING`,
      [organizationId, bouncerId, product.name, productId, relation.capacity,
        relation.recommendedAge, relation.priceRange, relation.motorsToPump, relation.bestFor,
        relation.features, product.imageUrl, relation.images]
    );
    return result.rowCount > 0;
  }
  if (relation.type === "indoorGame") {
    const result = await client.query(
      `INSERT INTO indoor_games (
         "organizationId", name, "productId", quantity, price, rate, availability,
         category, image, page, "piecesTotal", "piecesMissing", "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
       ON CONFLICT ("productId") DO NOTHING`,
      [organizationId, product.name, productId, product.stock, product.price, product.rate,
        relation.availability, relation.category, product.imageUrl, product.page,
        relation.piecesTotal, relation.piecesMissing]
    );
    return result.rowCount > 0;
  }
  return false;
};

const insertShopItem = async (client, organizationId, productId, product) => {
  if (!product.shopItem) return false;
  const result = await client.query(
    `INSERT INTO shop_items (
       "organizationId", name, "productId", description, price, currency, "ageRange",
       category, image, "isActive", "createdAt", "updatedAt"
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
     ON CONFLICT ("productId") DO NOTHING`,
    [organizationId, product.name, productId, product.description, product.price, product.currency,
      product.age, product.specificCategory, product.imageUrl, product.isActive]
  );
  return result.rowCount > 0;
};

export const applyCoreInventoryPlan = async (products) => {
  const appEnvironment = normalizeKey(process.env.APP_ENV);
  const railwayEnvironment = normalizeKey(process.env.RAILWAY_ENVIRONMENT_NAME);
  const organizationId = Number(process.env.REEBS_PUBLIC_ORGANIZATION_ID);
  if (appEnvironment !== "staging" || railwayEnvironment !== "staging") {
    throw new Error("Inventory import refused: APP_ENV and RAILWAY_ENVIRONMENT_NAME must both be staging.");
  }
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) {
    throw new Error("Inventory import refused: REEBS_PUBLIC_ORGANIZATION_ID must be a positive integer.");
  }
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(`Inventory import refused: ${CONFIRM_FLAG} is required with ${APPLY_FLAG}.`);
  }

  const { DATABASE_URL, resolvePgSslConfig } = await import("../../runtimeEnv.js");
  if (!DATABASE_URL) throw new Error("Inventory import refused: staging DATABASE_URL is unavailable.");
  const { Client } = await import("pg");
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: resolvePgSslConfig(),
    connectionTimeoutMillis: 10_000,
    statement_timeout: 120_000,
    application_name: "reebs-staging-core-inventory-import",
  });
  const result = { createdProducts: 0, existingProducts: 0, openingMovements: 0, relationships: 0, shopItems: 0 };
  try {
    await client.connect();
    const organization = await client.query(`SELECT id FROM organization WHERE id = $1 LIMIT 1`, [organizationId]);
    if (organization.rowCount !== 1) throw new Error("Inventory import refused: configured staging organization was not found.");
    await client.query("BEGIN");
    for (const product of products) {
      const persisted = await insertProduct(client, organizationId, product);
      if (!persisted.id) throw new Error(`Unable to resolve imported product ${product.sku}.`);
      if (persisted.created) {
        result.createdProducts += 1;
        if (await insertOpeningMovement(client, organizationId, persisted.id, product)) result.openingMovements += 1;
      } else {
        result.existingProducts += 1;
      }
      if (await insertRelationship(client, organizationId, persisted.id, product)) result.relationships += 1;
      if (await insertShopItem(client, organizationId, persisted.id, product)) result.shopItems += 1;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  try {
    const products = buildCoreInventoryPlan();
    console.log(JSON.stringify({ mode: process.argv.includes(APPLY_FLAG) ? "apply" : "plan", ...summarize(products) }, null, 2));
    if (process.argv.includes(APPLY_FLAG)) {
      const result = await applyCoreInventoryPlan(products);
      console.log(JSON.stringify({ applied: true, ...result }, null, 2));
    } else {
      console.log(`Dry run only. Use ${APPLY_FLAG} ${CONFIRM_FLAG} inside the Railway staging API service to write.`);
    }
  } catch (error) {
    console.error(error?.message || error);
    process.exitCode = 1;
  }
}
