/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  backfillProductVendorLinksFromProducts,
  ensureProductVendorLinksTable,
  getProductVendorIdsMap,
  getVendorProductSummaries,
  setProductVendorLinks,
} from "./_shared/productVendors.js";
import { requireUser } from "./_shared/userAuth.js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "vendor" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER DEFAULT 1,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobileMoneyNumber" TEXT,
    "address" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "leadTimeDays" INTEGER,
    "suppliedItems" TEXT[] NOT NULL DEFAULT '{}'::text[],
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER DEFAULT 1`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "contactName" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "email" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "mobileMoneyNumber" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "address" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "bankName" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "bankAccount" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "leadTimeDays" INTEGER`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "suppliedItems" TEXT[] DEFAULT '{}'::text[]`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "vendor" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
];

const productLinkStatements = [
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER DEFAULT 1`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "vendorId" INTEGER`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT false`,
];

const ensureVendorTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Vendor table check failed:", err?.message || err);
    }
  }
};

const ensureProductLinkColumns = async (client) => {
  for (const statement of productLinkStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Product link column check failed:", err?.message || err);
    }
  }
};

const hasColumn = async (client, tableName, columnName) => {
  const result = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2
     LIMIT 1`,
    [tableName, columnName]
  );
  return result.rowCount > 0;
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const uniqueTextList = (values = []) => {
  const seen = new Set();
  const list = [];
  for (const value of values) {
    const cleaned = cleanText(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    list.push(cleaned);
  }
  return list;
};

const parseSuppliedItems = (value) => {
  if (Array.isArray(value)) return uniqueTextList(value);
  if (typeof value !== "string") return [];
  return uniqueTextList(
    value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
};

const normalizeToken = (value) => {
  if (!value) return "";
  if (value.length > 3 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 3 && value.endsWith("es")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
};

const normalizeComparable = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean)
    .join(" ");

const scoreProductMatch = (productName, suppliedItem) => {
  const normalizedProduct = normalizeComparable(productName);
  const normalizedItem = normalizeComparable(suppliedItem);
  if (!normalizedProduct || !normalizedItem) return 0;
  if (normalizedProduct === normalizedItem) return 1000 + normalizedItem.length;
  if (
    normalizedProduct.startsWith(`${normalizedItem} `) ||
    normalizedProduct.endsWith(` ${normalizedItem}`) ||
    normalizedProduct.includes(` ${normalizedItem} `)
  ) {
    return 800 + normalizedItem.length;
  }
  if (
    normalizedItem.startsWith(`${normalizedProduct} `) ||
    normalizedItem.endsWith(` ${normalizedProduct}`) ||
    normalizedItem.includes(` ${normalizedProduct} `)
  ) {
    return 500 + normalizedProduct.length;
  }

  const productTokens = normalizedProduct.split(" ");
  const itemTokens = normalizedItem.split(" ");
  if (!itemTokens.length) return 0;
  const productTokenSet = new Set(productTokens);
  const matchingTokens = itemTokens.filter((token) => productTokenSet.has(token));
  if (matchingTokens.length === itemTokens.length) {
    return 650 + itemTokens.length * 12 + normalizedItem.length;
  }
  if (matchingTokens.length >= 2 && matchingTokens.length === Math.min(itemTokens.length, productTokens.length)) {
    return 350 + matchingTokens.length * 10 + normalizedItem.length;
  }
  return 0;
};

const collectVendorMatches = (productName, vendors = []) => {
  const matchesByVendor = new Map();
  for (const vendor of vendors) {
    const vendorId = Number(vendor.id);
    if (!Number.isFinite(vendorId) || vendorId <= 0) continue;
    const suppliedItems = Array.isArray(vendor.suppliedItems) ? vendor.suppliedItems : [];
    for (const suppliedItem of suppliedItems) {
      const score = scoreProductMatch(productName, suppliedItem);
      if (!score) continue;
      const existingMatch = matchesByVendor.get(vendorId);
      if (!existingMatch || score > existingMatch.score) {
        matchesByVendor.set(vendorId, {
          vendorId,
          vendorName: vendor.name || "Vendor",
          suppliedItem,
          score,
        });
      }
    }
  }

  return Array.from(matchesByVendor.values()).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.vendorName.localeCompare(right.vendorName);
  });
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS",
      },
      body: "",
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(401, { error: "Unauthorized" });
    }
    const organizationId = authUser.organizationId;
    await ensureVendorTable(client);
    await ensureProductLinkColumns(client);
    await ensureProductVendorLinksTable(client);
    await backfillProductVendorLinksFromProducts(client, organizationId);
    const hasVendorOrganizationId = await hasColumn(client, "vendor", "organizationId");
    const hasProductOrganizationId = await hasColumn(client, "product", "organizationId");
    const hasProductIsDeleted = await hasColumn(client, "product", "isDeleted");
    const hasProductIsArchived = await hasColumn(client, "product", "isArchived");

    if (event.httpMethod === "GET") {
      const params = hasVendorOrganizationId ? [organizationId] : [];
      const whereClause = hasVendorOrganizationId ? `WHERE v."organizationId" = $1` : "";
      const result = await client.query(
        `SELECT
          v.id,
          v.name,
          v."contactName",
          v.email,
          v.phone,
          v."mobileMoneyNumber",
          v.address,
          v."bankName",
          v."bankAccount",
          v."leadTimeDays",
          COALESCE(v."suppliedItems", '{}'::text[]) AS "suppliedItems",
          v.notes,
          v."createdAt",
          v."updatedAt"
        FROM "vendor" v
        ${whereClause}
        ORDER BY v.name ASC`,
        params
      );
      const vendorRows = Array.isArray(result.rows) ? result.rows : [];
      const vendorSummaries = await getVendorProductSummaries(client, {
        organizationId,
        vendorIds: vendorRows.map((vendor) => vendor.id),
      });

      return json(200, vendorRows.map((vendor) => {
        const summary = vendorSummaries.get(Number(vendor.id)) || {};
        return {
          ...vendor,
          products: Number(summary.products || 0),
          productNames: Array.isArray(summary.productNames) ? summary.productNames : [],
        };
      }));
    }

    if (event.httpMethod !== "POST" && event.httpMethod !== "PUT" && event.httpMethod !== "PATCH") {
      return json(405, { error: "Method Not Allowed" });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    if (event.httpMethod === "PATCH") {
      const action = cleanText(payload.action).toLowerCase();
      if (action !== "autolink-products") {
        return json(400, { error: "Unsupported vendor action." });
      }

      const vendorIdFilter = Number(payload.vendorId);
      const params = [];
      let vendorWhere = `WHERE COALESCE(array_length(v."suppliedItems", 1), 0) > 0`;
      if (hasVendorOrganizationId) {
        params.push(organizationId);
        vendorWhere += ` AND v."organizationId" = $${params.length}`;
      }
      if (Number.isFinite(vendorIdFilter) && vendorIdFilter > 0) {
        params.push(vendorIdFilter);
        vendorWhere += ` AND v.id = $${params.length}`;
      }

      const vendorRes = await client.query(
        `SELECT
           v.id,
           v.name,
           COALESCE(v."suppliedItems", '{}'::text[]) AS "suppliedItems"
         FROM "vendor" v
         ${vendorWhere}
         ORDER BY v.name ASC`,
        params
      );

      const vendors = (vendorRes.rows || []).map((row) => ({
        ...row,
        suppliedItems: parseSuppliedItems(row.suppliedItems),
      }));
      if (!vendors.length) {
        return json(200, {
          linkedCount: 0,
          skippedCount: 0,
          ambiguousCount: 0,
          items: [],
          message: "No vendors with supplied items were available to match.",
        });
      }

      const productParams = [];
      const productWhere = [`COALESCE(stock, 0) > 0`];
      if (hasProductOrganizationId) {
        productParams.push(organizationId);
        productWhere.push(`"organizationId" = $${productParams.length}`);
      }
      if (hasProductIsDeleted) {
        productWhere.push(`COALESCE("isDeleted", false) = false`);
      }
      if (hasProductIsArchived) {
        productWhere.push(`COALESCE("isArchived", false) = false`);
      }

      const productRes = await client.query(
        `SELECT id, name, stock
         FROM "product"
         WHERE ${productWhere.join(" AND ")}
         ORDER BY id ASC`,
        productParams
      );

      const productRows = Array.isArray(productRes.rows) ? productRes.rows : [];
      const linkedVendorIdsByProduct = await getProductVendorIdsMap(client, {
        organizationId,
        productIds: productRows.map((product) => product.id),
      });

      let linkedCount = 0;
      let linkedProductCount = 0;
      let skippedCount = 0;
      let ambiguousCount = 0;
      const linkedItems = [];

      for (const product of productRows) {
        const currentVendorIds = linkedVendorIdsByProduct.get(Number(product.id)) || [];
        if (!(Number.isFinite(vendorIdFilter) && vendorIdFilter > 0) && currentVendorIds.length) {
          skippedCount += 1;
          continue;
        }

        const matches = collectVendorMatches(product.name, vendors);
        if (!matches.length) continue;

        const newMatches = matches.filter((match) => !currentVendorIds.includes(match.vendorId));
        if (!newMatches.length) {
          skippedCount += 1;
          continue;
        }

        const nextVendorIds = currentVendorIds.length
          ? [...currentVendorIds, ...newMatches.map((match) => match.vendorId)]
          : newMatches.map((match) => match.vendorId);
        await setProductVendorLinks(client, {
          organizationId,
          productId: product.id,
          vendorIds: nextVendorIds,
        });
        linkedVendorIdsByProduct.set(Number(product.id), nextVendorIds);

        linkedCount += newMatches.length;
        linkedProductCount += 1;
        linkedItems.push({
          productId: Number(product.id),
          productName: product.name || "Untitled product",
          linkedVendors: newMatches.map((match) => ({
            vendorId: match.vendorId,
            vendorName: match.vendorName,
            matchedOn: match.suppliedItem,
          })),
        });
      }

      return json(200, {
        linkedCount,
        linkedProductCount,
        skippedCount,
        ambiguousCount,
        items: linkedItems,
        message: linkedCount
          ? `Created ${linkedCount} vendor link${linkedCount === 1 ? "" : "s"} across ${linkedProductCount} product${linkedProductCount === 1 ? "" : "s"}.`
          : "No matching in-stock products were linked.",
      });
    }

    const name = cleanText(payload.name);
    const contactName = cleanText(payload.contactName) || null;
    const email = cleanText(payload.email) || null;
    const phone = cleanText(payload.phone) || null;
    const mobileMoneyNumber = cleanText(payload.mobileMoneyNumber) || null;
    const address = cleanText(payload.address) || null;
    const bankName = cleanText(payload.bankName) || null;
    const bankAccount = cleanText(payload.bankAccount) || null;
    const leadTimeDays = Number.isFinite(Number(payload.leadTimeDays))
      ? Math.max(0, Number(payload.leadTimeDays))
      : null;
    const suppliedItems = parseSuppliedItems(payload.suppliedItems);
    const notes = cleanText(payload.notes) || null;

    if (event.httpMethod === "POST") {
      if (!name) return json(400, { error: "Vendor name is required." });

      const result = await client.query(
        `INSERT INTO "vendor"
          (${hasVendorOrganizationId ? `"organizationId", ` : ""}name, "contactName", email, phone, "mobileMoneyNumber", address, "bankName", "bankAccount", "leadTimeDays", "suppliedItems", notes, "createdAt", "updatedAt")
         VALUES (${hasVendorOrganizationId ? `$1, ` : ""}$${hasVendorOrganizationId ? 2 : 1}, $${hasVendorOrganizationId ? 3 : 2}, $${hasVendorOrganizationId ? 4 : 3}, $${hasVendorOrganizationId ? 5 : 4}, $${hasVendorOrganizationId ? 6 : 5}, $${hasVendorOrganizationId ? 7 : 6}, $${hasVendorOrganizationId ? 8 : 7}, $${hasVendorOrganizationId ? 9 : 8}, $${hasVendorOrganizationId ? 10 : 9}, $${hasVendorOrganizationId ? 11 : 10}, $${hasVendorOrganizationId ? 12 : 11}, NOW(), NOW())
         RETURNING id, name, "contactName", email, phone, "mobileMoneyNumber", address, "bankName", "bankAccount", "leadTimeDays", "suppliedItems", notes, "createdAt", "updatedAt"`,
        hasVendorOrganizationId
          ? [
              organizationId,
              name,
              contactName,
              email,
              phone,
              mobileMoneyNumber,
              address,
              bankName,
              bankAccount,
              leadTimeDays,
              suppliedItems,
              notes,
            ]
          : [name, contactName, email, phone, mobileMoneyNumber, address, bankName, bankAccount, leadTimeDays, suppliedItems, notes]
      );

      return json(200, result.rows[0]);
    }

    const id = Number(payload.id);
    if (!Number.isFinite(id)) return json(400, { error: "Vendor id is required." });

    const updates = [];
    const values = [];
    let index = 1;

    if (name) {
      updates.push(`name = $${index++}`);
      values.push(name);
    }
    updates.push(`"contactName" = $${index++}`);
    values.push(contactName);
    updates.push(`email = $${index++}`);
    values.push(email);
    updates.push(`phone = $${index++}`);
    values.push(phone);
    updates.push(`"mobileMoneyNumber" = $${index++}`);
    values.push(mobileMoneyNumber);
    updates.push(`address = $${index++}`);
    values.push(address);
    updates.push(`"bankName" = $${index++}`);
    values.push(bankName);
    updates.push(`"bankAccount" = $${index++}`);
    values.push(bankAccount);
    updates.push(`"leadTimeDays" = $${index++}`);
    values.push(leadTimeDays);
    updates.push(`"suppliedItems" = $${index++}`);
    values.push(suppliedItems);
    updates.push(`notes = $${index++}`);
    values.push(notes);
    updates.push(`"updatedAt" = NOW()`);

    values.push(id);
    if (hasVendorOrganizationId) {
      values.push(organizationId);
    }

    const result = await client.query(
      `UPDATE "vendor"
       SET ${updates.join(", ")}
       WHERE id = $${index}${hasVendorOrganizationId ? ` AND "organizationId" = $${index + 1}` : ""}
       RETURNING id, name, "contactName", email, phone, "mobileMoneyNumber", address, "bankName", "bankAccount", "leadTimeDays", "suppliedItems", notes, "createdAt", "updatedAt"`,
      values
    );

    if (result.rowCount === 0) {
      return json(404, { error: "Vendor not found." });
    }

    return json(200, result.rows[0]);
  } catch (err) {
    console.error("❌ Vendors error:", err);
    return json(500, {
      error:
        process.env.NODE_ENV === "production"
          ? "Failed to process vendors."
          : err?.message || "Failed to process vendors.",
    });
  } finally {
    await client.end().catch(() => {});
  }
}
