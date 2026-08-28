/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  backfillProductVendorLinksFromProducts,
  ensureProductVendorLinksTable,
  getProductVendorIdsMap,
} from "./_shared/productVendors.js";
import { hasPermission, requireInternalUser, respond } from "./_shared/internalApi.js";
import { applyWindowRateLimit } from "./_shared/requestRateLimit.js";
import {
  COMMERCIAL_BUSINESS_UNITS,
  COMMERCIAL_CONFIG_KEYS,
  WATER_PRICE_TYPES,
  buildCommercialRuleLockKey,
  buildWaterPriceLockKey,
  lockCommercialConfigurationKeys,
  resolveCommercialValue,
  resolveWaterProductPrice,
  resolveWaterSalePrice,
} from "./_shared/commercialConfig.js";
import {
  getEventHeader,
  getEventIpAddress,
  writeAuditLog,
} from "./_shared/auditLog.js";
import { withWaterBusinessContext } from "@faako/api-contracts/reebs";
import {
  calculateWaterCostBasis,
  DEFAULT_WATER_UNIT_COST,
} from "../../shared/waterFinancials.js";

const WATER_METHODS = "GET,POST,OPTIONS";
const WATER_ALLOWED_ROLES = ["owner", "admin", "water"];
const PRODUCT_NAME = "15pk Gwater";
const PRODUCT_KEY = "gwater-15pk";
const PRODUCT_NAME_ALIASES = [PRODUCT_NAME, PRODUCT_KEY.replace(/-/g, " "), "15 pk Gwater"];
const DEFAULT_PURCHASE_COST = DEFAULT_WATER_UNIT_COST;
const MAX_WATER_BODY_BYTES = 16 * 1024;
const MAX_WATER_QUANTITY = 100000;
const MAX_WATER_AMOUNT_CENTS = 100000000;
const MAX_ACTION_LENGTH = 40;
const MAX_NAME_LENGTH = 160;
const MAX_PHONE_LENGTH = 40;
const MAX_REFERENCE_LENGTH = 120;
const MAX_REASON_LENGTH = 120;
const MAX_CATEGORY_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 240;
const MAX_NOTES_LENGTH = 500;
const MAX_VENDOR_NAME_LENGTH = 160;
const MAX_PRICE_OVERRIDE_REASON_LENGTH = 300;
const WATER_READ_RATE_LIMIT = {
  limit: 180,
  windowMs: 60_000,
};
const WATER_WRITE_RATE_LIMIT = {
  limit: 45,
  windowMs: 60_000,
};
const WATER_ACTIONS = new Set([
  "restock",
  "update_restock",
  "delete_restock",
  "sale",
  "update_sale",
  "delete_sale",
  "expense",
  "update_expense",
  "delete_expense",
  "adjustment",
  "update_adjustment",
  "delete_adjustment",
  "update_product_pricing",
]);

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "waterRestock" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL DEFAULT '${PRODUCT_KEY}',
    "productName" TEXT NOT NULL DEFAULT '${PRODUCT_NAME}',
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "vendorName" TEXT,
    "notes" TEXT,
    "date" TIMESTAMPTZ NOT NULL,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS "waterSale" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL DEFAULT '${PRODUCT_KEY}',
    "productName" TEXT NOT NULL DEFAULT '${PRODUCT_NAME}',
    "quantity" INTEGER NOT NULL,
    "saleChannel" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "paymentReference" TEXT,
    "providerReference" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "customerId" INTEGER,
    "customerName" TEXT,
    "notes" TEXT,
    "date" TIMESTAMPTZ NOT NULL,
    "paidAt" TIMESTAMPTZ,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "customerId" INTEGER`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'cash'`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'paid'`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "providerReference" TEXT`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "discountType" TEXT NOT NULL DEFAULT 'none'`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "discountValue" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "updatedByName" TEXT`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "archivedByName" TEXT`,
  `CREATE TABLE IF NOT EXISTS "waterExpense" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMPTZ NOT NULL,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "waterExpense" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ`,
  `ALTER TABLE "waterExpense" ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER`,
  `ALTER TABLE "waterExpense" ADD COLUMN IF NOT EXISTS "archivedByName" TEXT`,
  `CREATE TABLE IF NOT EXISTS "waterAdjustment" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL DEFAULT '${PRODUCT_KEY}',
    "productName" TEXT NOT NULL DEFAULT '${PRODUCT_NAME}',
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMPTZ NOT NULL,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

const productLinkStatements = [
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER DEFAULT 1`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "vendorId" INTEGER`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT false`,
];

const ensureTables = async (client) => {
  for (const statement of tableStatements) {
    await client.query(statement);
  }

  await client.query(
    `UPDATE "waterSale"
     SET "paymentStatus" = CASE
       WHEN LOWER(COALESCE("paymentMethod", 'cash')) = 'credit' THEN 'unpaid'
       ELSE 'paid'
     END
     WHERE COALESCE(NULLIF(TRIM("paymentStatus"), ''), '') = ''
        OR (
          LOWER(COALESCE("paymentMethod", 'cash')) = 'momo'
          AND LOWER(COALESCE("paymentStatus", 'paid')) = 'pending'
        )
        OR (
          LOWER(COALESCE("paymentMethod", 'cash')) = 'credit'
          AND LOWER(COALESCE("paymentStatus", 'paid')) = 'paid'
        )`
  );
  await client.query(
    `UPDATE "waterSale"
     SET "paymentReference" = 'WATER-' || "organizationId"::text || '-' || id::text
     WHERE COALESCE(NULLIF(TRIM("paymentReference"), ''), '') = ''`
  );
  await client.query(
    `UPDATE "waterSale"
     SET "paidAt" = COALESCE("paidAt", date)
     WHERE LOWER(COALESCE("paymentStatus", 'paid')) = 'paid'
       AND "paidAt" IS NULL`
  );
};

const ensureProductLinkColumns = async (client) => {
  for (const statement of productLinkStatements) {
    try {
      await client.query(statement);
    } catch (error) {
      console.warn("Water product link check failed:", error?.message || error);
    }
  }
};

const stripControlCharacters = (value) =>
  Array.from(String(value || ""))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");

const cleanText = (value, maxLength = MAX_NOTES_LENGTH) => {
  if (typeof value !== "string") return "";
  return stripControlCharacters(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(0, Number(maxLength) || 0))
    .trim();
};

export const normalizeWaterAction = (value) => {
  const cleaned = cleanText(value, MAX_ACTION_LENGTH).toLowerCase();
  if (!cleaned) return "";

  const normalized = cleaned.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const aliases = {
    update_retail_price: "update_product_pricing",
    retail_price: "update_product_pricing",
    set_retail_price: "update_product_pricing",
    update_product_price: "update_product_pricing",
    update_price: "update_product_pricing",
    product_pricing: "update_product_pricing",
  };

  if (WATER_ACTIONS.has(normalized)) return normalized;
  return aliases[normalized] || "";
};

const normalizeComparableText = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const parsePositiveInteger = (value, max = MAX_WATER_QUANTITY) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded > 0 && rounded <= max ? rounded : null;
};

const parseSignedInteger = (value, max = MAX_WATER_QUANTITY) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return rounded !== 0 && Math.abs(rounded) <= max ? rounded : null;
};

const parseMoney = (value, maxCents = MAX_WATER_AMOUNT_CENTS) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const cents = Math.round(value * 100);
    return cents > 0 && cents <= maxCents ? cents : null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const cents = Math.round(parsed * 100);
  return cents > 0 && cents <= maxCents ? cents : null;
};

export const resolveWaterPriceDecision = ({
  standardPriceCents,
  submittedPriceCents = null,
  hasSubmittedPrice = false,
  canOverride = false,
  overrideReason = "",
} = {}) => {
  const standardPrice = Math.round(Number(standardPriceCents));
  if (!Number.isFinite(standardPrice) || standardPrice <= 0) {
    return { error: "Required Water pricing is unavailable.", statusCode: 503 };
  }
  if (!hasSubmittedPrice) {
    return {
      unitPrice: standardPrice,
      standardUnitPrice: standardPrice,
      isOverride: false,
      overrideReason: null,
    };
  }

  const submittedPrice = Math.round(Number(submittedPriceCents));
  if (!Number.isFinite(submittedPrice) || submittedPrice <= 0) {
    return { error: "Sale price must be greater than zero.", statusCode: 400 };
  }
  if (submittedPrice === standardPrice) {
    return {
      unitPrice: standardPrice,
      standardUnitPrice: standardPrice,
      isOverride: false,
      overrideReason: null,
    };
  }
  if (!canOverride) {
    return {
      error: "Water price overrides require Water pricing management permission.",
      statusCode: 403,
    };
  }

  const reason = cleanText(overrideReason, MAX_PRICE_OVERRIDE_REASON_LENGTH);
  if (!reason) {
    return { error: "A reason is required for a Water price override.", statusCode: 400 };
  }
  return {
    unitPrice: submittedPrice,
    standardUnitPrice: standardPrice,
    isOverride: true,
    overrideReason: reason,
  };
};

export const resolveWaterRestockUnitCost = (payload = {}, fallbackUnitCost = null) => {
  if (Object.prototype.hasOwnProperty.call(payload, "unitCost")) {
    return parseMoney(payload.unitCost);
  }
  const parsedFallback = Math.round(Number(fallbackUnitCost));
  return Number.isFinite(parsedFallback) && parsedFallback > 0
    ? parsedFallback
    : null;
};

export const didWaterSalePricingBasisChange = (existingSale = {}, nextSale = {}) => {
  const existingDate = new Date(existingSale.date || "").getTime();
  const nextDate = new Date(nextSale.date || "").getTime();
  return Number(existingSale.quantity) !== Number(nextSale.quantity)
    || normalizeChannel(existingSale.saleChannel) !== normalizeChannel(nextSale.saleChannel)
    || !Number.isFinite(existingDate)
    || !Number.isFinite(nextDate)
    || existingDate !== nextDate;
};

const parseDate = (value) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

export const resolveWaterCommercialTimestamp = (saleDate, now = new Date()) => {
  const parsedSaleDate = new Date(saleDate);
  const parsedNow = new Date(now);
  if (!Number.isFinite(parsedSaleDate.getTime()) || !Number.isFinite(parsedNow.getTime())) {
    return saleDate;
  }
  const saleIso = parsedSaleDate.toISOString();
  const nowIso = parsedNow.toISOString();
  const isDateOnlyMidnight = saleIso.endsWith("T00:00:00.000Z");
  return isDateOnlyMidnight && saleIso.slice(0, 10) === nowIso.slice(0, 10)
    ? nowIso
    : saleIso;
};

const toAmount = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeChannel = (value) => {
  const normalized = cleanText(value).toLowerCase();
  return normalized === "company" ? "company" : "retail";
};

const normalizePaymentMethod = (value) => {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "momo") return "momo";
  if (normalized === "credit" || normalized === "pay later" || normalized === "paylater") {
    return "credit";
  }
  return "cash";
};

const normalizePaymentStatus = (value, paymentMethod = "cash") => {
  const normalized = cleanText(value).toLowerCase();
  if (
    normalized === "paid" ||
    normalized === "success" ||
    normalized === "successful" ||
    normalized === "completed" ||
    normalized === "confirmed"
  ) {
    return "paid";
  }
  if (normalized === "pending" || normalized === "processing" || normalized === "awaiting") {
    return "pending";
  }
  if (
    normalized === "unpaid" ||
    normalized === "credit" ||
    normalized === "due" ||
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "unpaid";
  }

  const method = normalizePaymentMethod(paymentMethod);
  if (method === "credit") return "unpaid";
  return "paid";
};

const normalizeDiscountType = (value) => {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "amount") return "amount";
  if (normalized === "percent" || normalized === "percentage") return "percent";
  return "none";
};

const parsePercentValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
};

export const resolveSaleDiscount = (
  discountType,
  rawValue,
  subtotalAmount,
  maximumDiscountBps = null
) => {
  if (subtotalAmount <= 0 || discountType === "none") {
    return {
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
    };
  }

  if (discountType === "amount") {
    const discountValue = parseMoney(rawValue);
    if (!discountValue) {
      return { error: "Discount amount must be greater than zero." };
    }
    if (discountValue >= subtotalAmount) {
      return { error: "Discount amount must be less than the sale total." };
    }
    if (
      Number.isInteger(maximumDiscountBps)
      && discountValue * 10000 > subtotalAmount * maximumDiscountBps
    ) {
      return { error: "Discount exceeds the configured Water discount limit." };
    }
    return {
      discountType,
      discountValue,
      discountAmount: discountValue,
    };
  }

  const discountValue = parsePercentValue(rawValue);
  if (!discountValue) {
    return { error: "Discount percent must be greater than zero." };
  }
  if (discountValue >= 10000) {
    return { error: "Discount percent must be less than 100%." };
  }
  if (Number.isInteger(maximumDiscountBps) && discountValue > maximumDiscountBps) {
    return { error: "Discount exceeds the configured Water discount limit." };
  }

  const discountAmount = Math.round((subtotalAmount * discountValue) / 10000);
  if (discountAmount <= 0 || discountAmount >= subtotalAmount) {
    return { error: "Discount percent must leave a positive sale total." };
  }

  return {
    discountType,
    discountValue,
    discountAmount,
  };
};

const buildPaymentReference = (organizationId, saleId) => `WATER-${organizationId}-${saleId}`;

const getHeaderValue = (event, key) => {
  const headers = event?.headers;
  if (!headers || typeof headers !== "object") return "";
  return String(headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()] || "").trim();
};

const getRequesterIp = (event) => {
  const forwarded = String(
    getHeaderValue(event, "x-forwarded-for")
      || getHeaderValue(event, "client-ip")
      || getHeaderValue(event, "x-nf-client-connection-ip")
      || ""
  )
    .split(",")[0]
    .trim();
  return forwarded ? forwarded.slice(0, 64) : null;
};

const buildUserRateLimitIdentifier = (organizationId, authUser) => {
  const safeOrganizationId =
    Number.isInteger(Number(organizationId)) && Number(organizationId) > 0
      ? Number(organizationId)
      : "unknown";
  const safeUserId =
    Number.isInteger(Number(authUser?.id)) && Number(authUser?.id) > 0
      ? Number(authUser.id)
      : "anonymous";
  const safeRole = cleanText(authUser?.role, 32).toLowerCase() || "unknown";
  return `org:${safeOrganizationId}|user:${safeUserId}|role:${safeRole}`;
};

const buildIpRateLimitIdentifier = (event, organizationId) => {
  const safeOrganizationId =
    Number.isInteger(Number(organizationId)) && Number(organizationId) > 0
      ? Number(organizationId)
      : "unknown";
  const ipAddress = getRequesterIp(event) || "unknown";
  return `org:${safeOrganizationId}|ip:${ipAddress}`;
};

const enforceWaterRateLimit = async (
  client,
  event,
  { organizationId, authUser, method = "GET", action = "" } = {}
) => {
  const normalizedMethod = String(method || "GET").toUpperCase();
  const safeAction = cleanText(action, MAX_ACTION_LENGTH).toLowerCase() || "default";
  const scope = normalizedMethod === "GET" ? "water:read" : `water:write:${safeAction}`;
  const limitConfig = normalizedMethod === "GET" ? WATER_READ_RATE_LIMIT : WATER_WRITE_RATE_LIMIT;
  const [userLimit, ipLimit] = await Promise.all([
    applyWindowRateLimit(client, {
      scope,
      identifier: buildUserRateLimitIdentifier(organizationId, authUser),
      ...limitConfig,
    }),
    applyWindowRateLimit(client, {
      scope,
      identifier: buildIpRateLimitIdentifier(event, organizationId),
      ...limitConfig,
    }),
  ]);

  if (!userLimit.allowed) return userLimit;
  if (!ipLimit.allowed) return ipLimit;

  return {
    ...userLimit,
    remaining: Math.min(userLimit.remaining, ipLimit.remaining),
    retryAfterSeconds: Math.max(userLimit.retryAfterSeconds, ipLimit.retryAfterSeconds),
    resetAt: new Date(
      Math.max(Date.parse(userLimit.resetAt) || 0, Date.parse(ipLimit.resetAt) || 0)
    ).toISOString(),
  };
};

const isSaleCollected = (row) =>
  normalizePaymentStatus(row?.paymentStatus, row?.paymentMethod) === "paid";

const loadWaterCommercialPricing = async (
  client,
  organizationId,
  at = new Date()
) => {
  const [retail, bulkRetail, company, discountLimitBps] = await Promise.all([
    resolveWaterProductPrice(client, {
      organizationId,
      productKey: PRODUCT_KEY,
      priceType: WATER_PRICE_TYPES.RETAIL,
      at,
    }),
    resolveWaterProductPrice(client, {
      organizationId,
      productKey: PRODUCT_KEY,
      priceType: WATER_PRICE_TYPES.BULK_RETAIL,
      at,
    }),
    resolveWaterProductPrice(client, {
      organizationId,
      productKey: PRODUCT_KEY,
      priceType: WATER_PRICE_TYPES.COMPANY,
      at,
    }),
    resolveCommercialValue(client, {
      organizationId,
      businessUnit: COMMERCIAL_BUSINESS_UNITS.WATER,
      key: COMMERCIAL_CONFIG_KEYS.WATER_DISCOUNT_LIMIT_BPS,
      at,
    }),
  ]);

  return {
    currency: retail.currency,
    retailSingle: retail.priceCents,
    retailBulk: bulkRetail.priceCents,
    company: company.priceCents,
    bulkThreshold: bulkRetail.minimumQuantity,
    discountLimitBps,
    records: {
      retail,
      bulkRetail,
      company,
    },
  };
};

const loadWaterDashboardPricing = async (client, organizationId, at = new Date()) => {
  try {
    return await loadWaterCommercialPricing(client, organizationId, at);
  } catch (error) {
    if (Number(error?.statusCode) !== 503) throw error;
    return {
      currency: null,
      retailSingle: null,
      retailBulk: null,
      company: null,
      bulkThreshold: null,
      discountLimitBps: null,
      records: null,
      configurationError: error.message,
      configurationErrorCode: error.code || "MISSING_WATER_PRICING",
    };
  }
};

const resolveWaterUnitCostAtSale = async (
  client,
  organizationId,
  at,
  productKey = PRODUCT_KEY
) => {
  const result = await client.query(
    `SELECT "unitCost"
     FROM "waterRestock"
     WHERE "organizationId" = $1
       AND "productKey" = $2
       AND date <= $3
       AND "unitCost" > 0
     ORDER BY date DESC, "createdAt" DESC, id DESC
     LIMIT 1`,
    [organizationId, productKey, new Date(at).toISOString()]
  );
  const unitCost = Math.round(Number(result.rows?.[0]?.unitCost));
  if (!Number.isFinite(unitCost) || unitCost <= 0) {
    const error = new Error(
      "A valid Water restock cost is required before this sale can be recorded."
    );
    error.statusCode = 503;
    error.code = "MISSING_WATER_COST_BASIS";
    throw error;
  }
  return unitCost;
};

export const restateWaterSaleCostSnapshots = async (
  client,
  { organizationId, productKey = PRODUCT_KEY, userId = null, userName = null }
) => {
  const unresolvedResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM "waterSale" AS sale
     WHERE sale."organizationId" = $1
       AND sale."productKey" = $2
       AND sale."archivedAt" IS NULL
       AND sale."unitCostAtSaleCents" > 0
       AND NOT EXISTS (
         SELECT 1
         FROM "waterRestock" AS restock
         WHERE restock."organizationId" = sale."organizationId"
           AND restock."productKey" = sale."productKey"
           AND restock.date <= sale.date
           AND restock."unitCost" > 0
       )`,
    [organizationId, productKey]
  );
  if (Number(unresolvedResult.rows?.[0]?.count) > 0) {
    const error = new Error(
      "This restock change would remove the recorded cost basis from an existing Water sale."
    );
    error.statusCode = 409;
    error.code = "WATER_COST_BASIS_REQUIRED";
    throw error;
  }

  const restatedSales = await client.query(
    `WITH resolved_cost AS (
       SELECT
         sale.id,
         (
           SELECT restock."unitCost"
           FROM "waterRestock" AS restock
           WHERE restock."organizationId" = sale."organizationId"
             AND restock."productKey" = sale."productKey"
             AND restock.date <= sale.date
             AND restock."unitCost" > 0
           ORDER BY restock.date DESC, restock."createdAt" DESC, restock.id DESC
           LIMIT 1
         ) AS "unitCost"
       FROM "waterSale" AS sale
       WHERE sale."organizationId" = $1
         AND sale."productKey" = $2
         AND sale."archivedAt" IS NULL
     )
     UPDATE "waterSale" AS sale
     SET "unitCostAtSaleCents" = resolved_cost."unitCost",
         "updatedAt" = NOW(),
         "updatedByUserId" = $3,
         "updatedByName" = $4
     FROM resolved_cost
     WHERE sale.id = resolved_cost.id
       AND resolved_cost."unitCost" > 0
       AND sale."unitCostAtSaleCents" IS DISTINCT FROM resolved_cost."unitCost"
     RETURNING sale.id`,
    [organizationId, productKey, userId, userName]
  );
  return restatedSales.rowCount || 0;
};

const auditWaterPriceOverride = async (
  client,
  event,
  {
    organizationId,
    authUser,
    saleId,
    standardUnitPrice,
    overrideUnitPrice,
    reason,
    action,
  }
) => writeAuditLog(client, {
  organizationId,
  userId: Number(authUser.id) || null,
  action,
  targetType: "waterSale",
  targetId: String(saleId),
  category: "finance",
  severity: "warning",
  status: "ok",
  summary: "An authorized Water sale price override was recorded.",
  actorLabel: authUser.fullName || authUser.email,
  requestId: getEventHeader(event, "x-request-id"),
  ipAddress: getEventIpAddress(event),
  metadata: {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.WATER,
    standardUnitPrice,
    overrideUnitPrice,
    reason,
  },
});

const runWaterTransaction = async (client, operation) => {
  await client.query("BEGIN");
  try {
    const result = await operation();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};

const lockWaterInventory = (client, organizationId) => client.query(
  `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
  [`water-inventory:${organizationId}:${PRODUCT_KEY}`]
);

const lockWaterSaleCommercialTerms = (
  client,
  { organizationId, saleChannel, includePricing = true, includeDiscount = true }
) => {
  const priceTypes = includePricing
    ? normalizeChannel(saleChannel) === "company"
      ? [WATER_PRICE_TYPES.COMPANY]
      : [WATER_PRICE_TYPES.RETAIL, WATER_PRICE_TYPES.BULK_RETAIL]
    : [];
  const lockKeys = priceTypes.map((priceType) =>
    buildWaterPriceLockKey(organizationId, PRODUCT_KEY, priceType)
  );
  if (includeDiscount) {
    lockKeys.push(buildCommercialRuleLockKey(
      organizationId,
      COMMERCIAL_BUSINESS_UNITS.WATER,
      COMMERCIAL_CONFIG_KEYS.WATER_DISCOUNT_LIMIT_BPS
    ));
  }
  return lockCommercialConfigurationKeys(client, lockKeys);
};

const findCustomerByName = async (client, organizationId, name) => {
  const normalizedName = cleanText(name, MAX_NAME_LENGTH);
  if (!normalizedName) return null;
  const result = await client.query(
    `SELECT id, name, phone
     FROM "customer"
     WHERE "organizationId" = $1
       AND LOWER(regexp_replace(TRIM(name), '\\s+', ' ', 'g'))
         = LOWER(regexp_replace(TRIM($2), '\\s+', ' ', 'g'))
     LIMIT 1`,
    [organizationId, normalizedName]
  );
  return result.rows?.[0] || null;
};

const updateCustomerPhone = async (client, organizationId, customerId, phone) => {
  const normalizedPhone = cleanText(phone, MAX_PHONE_LENGTH);
  if (!normalizedPhone) return null;
  const result = await client.query(
    `UPDATE "customer"
     SET "phone" = $3,
         "updatedAt" = NOW()
     WHERE id = $1 AND "organizationId" = $2
     RETURNING id, name, phone`,
    [customerId, organizationId, normalizedPhone]
  );
  return result.rows?.[0] || null;
};

const insertCustomerByName = async (client, organizationId, name, phone = null) => {
  const normalizedName = cleanText(name, MAX_NAME_LENGTH);
  const normalizedPhone = cleanText(phone, MAX_PHONE_LENGTH) || null;
  if (!normalizedName) return null;
  const result = await client.query(
    `INSERT INTO "customer" ("organizationId", "name", "phone", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING id, name, phone`,
    [organizationId, normalizedName, normalizedPhone]
  );
  return result.rows?.[0] || null;
};

const findOrCreateCustomerByName = async (client, organizationId, name, phone = null) => {
  const normalizedName = cleanText(name, MAX_NAME_LENGTH);
  const normalizedPhone = cleanText(phone, MAX_PHONE_LENGTH);
  if (!normalizedName) return null;

  const existing = await findCustomerByName(client, organizationId, normalizedName);
  if (existing) {
    if (normalizedPhone && cleanText(existing.phone) !== normalizedPhone) {
      return (
        (await updateCustomerPhone(client, organizationId, Number(existing.id), normalizedPhone)) ||
        existing
      );
    }
    return existing;
  }
  try {
    return await insertCustomerByName(client, organizationId, normalizedName, normalizedPhone);
  } catch (err) {
    if (err?.code === "23505" && err?.constraint === "customer_pkey") {
      const seqRes = await client.query(`SELECT pg_get_serial_sequence('"customer"', 'id') AS seq`);
      const seqName = seqRes.rows?.[0]?.seq;
      if (seqName) {
        const nextRes = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM "customer"`);
        const nextId = Number(nextRes.rows?.[0]?.next_id) || 1;
        await client.query(`SELECT setval($1::regclass, $2, false)`, [seqName, nextId]);
        return await insertCustomerByName(client, organizationId, normalizedName, normalizedPhone);
      }
    }
    throw err;
  }
};

const selectRows = async (client, queryRef, columns, organizationId, extraWhere = "") => {
  const result = await client.query(
    `SELECT ${columns.join(", ")}
     FROM ${queryRef}
     WHERE "organizationId" = $1
     ${extraWhere ? `AND ${extraWhere}` : ""}
     ORDER BY date DESC, id DESC`,
    [organizationId]
  );
  return result.rows || [];
};

const hasTable = async (client, tableName) => {
  const result = await client.query(`SELECT to_regclass($1) AS table_ref`, [tableName]);
  return Boolean(result.rows?.[0]?.table_ref);
};

const scoreWaterProductCandidate = (candidateName) => {
  const normalizedCandidate = normalizeComparableText(candidateName);
  if (!normalizedCandidate) return 0;

  let bestScore = normalizedCandidate.includes("gwater") ? 300 : normalizedCandidate.includes("water") ? 100 : 0;

  for (const alias of PRODUCT_NAME_ALIASES) {
    const normalizedAlias = normalizeComparableText(alias);
    if (!normalizedAlias) continue;

    if (normalizedCandidate === normalizedAlias) {
      bestScore = Math.max(bestScore, 1000 + normalizedAlias.length);
      continue;
    }

    if (
      normalizedCandidate.includes(normalizedAlias) ||
      normalizedAlias.includes(normalizedCandidate)
    ) {
      bestScore = Math.max(
        bestScore,
        700 + Math.min(normalizedCandidate.length, normalizedAlias.length)
      );
      continue;
    }

    const candidateTokens = normalizedCandidate.split(" ");
    const aliasTokens = normalizedAlias.split(" ");
    const aliasTokenSet = new Set(aliasTokens);
    const sharedTokens = candidateTokens.filter((token) => aliasTokenSet.has(token));
    if (sharedTokens.length >= 2) {
      bestScore = Math.max(bestScore, 400 + sharedTokens.length * 25);
    }
  }

  return bestScore;
};

const resolveLinkedWaterVendors = async (client, organizationId) => {
  const productTableExists = await hasTable(client, "product");
  if (!productTableExists) {
    return {
      inventoryProductId: null,
      linkedVendorIds: [],
    };
  }

  await ensureProductLinkColumns(client);
  await ensureProductVendorLinksTable(client);
  await backfillProductVendorLinksFromProducts(client, organizationId);

  const productResult = await client.query(
    `SELECT id, name, price
     FROM "product"
     WHERE "organizationId" = $1
       AND COALESCE("isDeleted", false) = false
       AND COALESCE("isArchived", false) = false
       AND LOWER(COALESCE(name, '')) LIKE '%water%'
     ORDER BY id ASC
     LIMIT 100`,
    [organizationId]
  );

  const candidates = Array.isArray(productResult.rows) ? productResult.rows : [];
  let matchedProduct = null;
  let matchedScore = 0;

  for (const candidate of candidates) {
    const score = scoreWaterProductCandidate(candidate?.name);
    if (score <= 0) continue;
    if (!matchedProduct || score > matchedScore) {
      matchedProduct = candidate;
      matchedScore = score;
    }
  }

  if (!matchedProduct) {
    return {
      inventoryProductId: null,
      linkedVendorIds: [],
    };
  }

  const vendorIdsByProduct = await getProductVendorIdsMap(client, {
    organizationId,
    productIds: [matchedProduct.id],
  });
  const linkedVendorIds = vendorIdsByProduct.get(Number(matchedProduct.id)) || [];

  return {
    inventoryProductId: Number(matchedProduct.id) || null,
    linkedVendorIds,
    retailPrice:
      Number.isFinite(Number(matchedProduct.price)) && Number(matchedProduct.price) > 0
        ? Number(matchedProduct.price)
        : RETAIL_PRICE,
  };
};

export const buildWaterSummary = ({ restocks, sales, expenses, adjustments }) => {
  const unitsRestocked = restocks.reduce((sum, row) => sum + toAmount(row.quantity), 0);
  const unitsSold = sales.reduce((sum, row) => sum + toAmount(row.quantity), 0);
  const adjustmentUnits = adjustments.reduce((sum, row) => sum + toAmount(row.quantityDelta), 0);
  const stockOnHand = Math.max(0, unitsRestocked - unitsSold + adjustmentUnits);
  const revenue = sales.reduce((sum, row) => sum + toAmount(row.totalAmount), 0);
  const cashCollected = sales.reduce((sum, row) => {
    return isSaleCollected(row) ? sum + toAmount(row.totalAmount) : sum;
  }, 0);
  const outstandingCredit = sales.reduce((sum, row) => {
    return normalizePaymentMethod(row.paymentMethod) === "credit" && !isSaleCollected(row)
      ? sum + toAmount(row.totalAmount)
      : sum;
  }, 0);
  const cashSalesTotal = sales.reduce((sum, row) => {
    return normalizePaymentMethod(row.paymentMethod) === "cash"
      ? sum + toAmount(row.totalAmount)
      : sum;
  }, 0);
  const momoSalesTotal = sales.reduce((sum, row) => {
    return normalizePaymentMethod(row.paymentMethod) === "momo"
      ? sum + toAmount(row.totalAmount)
      : sum;
  }, 0);
  const pendingCash = sales.reduce((sum, row) => {
    return normalizePaymentMethod(row.paymentMethod) === "cash" && !isSaleCollected(row)
      ? sum + toAmount(row.totalAmount)
      : sum;
  }, 0);
  const pendingMomo = sales.reduce((sum, row) => {
    return normalizePaymentMethod(row.paymentMethod) === "momo" && !isSaleCollected(row)
      ? sum + toAmount(row.totalAmount)
      : sum;
  }, 0);
  const extraExpenses = expenses.reduce((sum, row) => sum + toAmount(row.amount), 0);
  const {
    restockSpend,
    costOfGoodsSold,
    inventoryValue,
    currentUnitCost,
  } = calculateWaterCostBasis({
    restocks,
    sales,
    unitsSold,
    stockOnHand,
    fallbackUnitCost: DEFAULT_PURCHASE_COST,
  });
  const grossProfit = revenue - costOfGoodsSold;
  const netProfit = grossProfit - extraExpenses;
  const cashPosition = cashCollected - restockSpend - extraExpenses;

  return {
    stockOnHand,
    unitsRestocked,
    unitsSold,
    adjustmentUnits,
    revenue,
    restockSpend,
    extraExpenses,
    costOfGoodsSold,
    grossProfit,
    netProfit,
    cashCollected,
    outstandingCredit,
    cashSalesTotal,
    momoSalesTotal,
    pendingCash,
    pendingMomo,
    cashPosition,
    inventoryValue,
    currentUnitCost,
  };
};

const buildDashboard = async (client, organizationId, options = {}) => {
  const includeLinkedProduct = options.includeLinkedProduct !== false;
  const includePricing = options.includePricing !== false;
  const pricingAt = options.at || new Date();
  const [restocks, sales, expenses, adjustments, linkedProduct, commercialPricing] = await Promise.all([
    selectRows(
      client,
      `"waterRestock"`,
      [
        "id",
        "\"productKey\"",
        "\"productName\"",
        "quantity",
        "\"unitCost\"",
        "\"vendorId\"",
        "\"vendorName\"",
        "notes",
        "date",
        "\"createdByUserId\"",
        "\"createdByName\"",
        "\"createdAt\"",
      ],
      organizationId
    ),
    selectRows(
      client,
      `"waterSale"`,
      [
        "id",
        "\"productKey\"",
        "\"productName\"",
        "quantity",
        "\"saleChannel\"",
        "\"paymentMethod\"",
        "\"paymentStatus\"",
        "\"paymentReference\"",
        "\"providerReference\"",
        "\"discountType\"",
        "\"discountValue\"",
        "\"discountAmount\"",
        "\"unitPrice\"",
        "\"standardUnitPrice\"",
        "\"waterProductPriceId\"",
        "\"priceOverrideReason\"",
        "\"priceOverriddenByUserId\"",
        "\"priceOverriddenAt\"",
        "\"unitCostAtSaleCents\"",
        "\"totalAmount\"",
        "\"customerId\"",
        "\"customerName\"",
        "notes",
        "date",
        "\"paidAt\"",
        "\"createdByUserId\"",
        "\"createdByName\"",
        "\"createdAt\"",
        "\"updatedAt\"",
        "\"updatedByUserId\"",
        "\"updatedByName\"",
      ],
      organizationId,
      `"archivedAt" IS NULL`
    ),
    selectRows(
      client,
      `"waterExpense"`,
      [
        "id",
        "category",
        "amount",
        "description",
        "notes",
        "date",
        "\"createdByUserId\"",
        "\"createdByName\"",
        "\"createdAt\"",
      ],
      organizationId,
      `"archivedAt" IS NULL`
    ),
    selectRows(
      client,
      `"waterAdjustment"`,
      [
        "id",
        "\"productKey\"",
        "\"productName\"",
        "\"quantityDelta\"",
        "reason",
        "notes",
        "date",
        "\"createdByUserId\"",
        "\"createdByName\"",
        "\"createdAt\"",
      ],
      organizationId
    ),
    includeLinkedProduct
      ? resolveLinkedWaterVendors(client, organizationId)
      : Promise.resolve({
          inventoryProductId: null,
          linkedVendorIds: [],
        }),
    includePricing
      ? loadWaterDashboardPricing(client, organizationId, pricingAt)
      : Promise.resolve(null),
  ]);

  const latestRecordedUnitCost = Number(restocks[0]?.unitCost);

  return withWaterBusinessContext({
    product: {
      key: PRODUCT_KEY,
      name: PRODUCT_NAME,
      inventoryProductId: linkedProduct.inventoryProductId,
      linkedVendorIds: linkedProduct.linkedVendorIds,
      purchaseCost:
        Number.isFinite(latestRecordedUnitCost) && latestRecordedUnitCost > 0
          ? Math.round(latestRecordedUnitCost)
          : DEFAULT_PURCHASE_COST,
      pricing: {
        currency: commercialPricing?.currency || null,
        retailSingle: commercialPricing?.retailSingle ?? null,
        retailBulk: commercialPricing?.retailBulk ?? null,
        company: commercialPricing?.company ?? null,
        bulkThreshold: commercialPricing?.bulkThreshold ?? null,
        discountLimitBps: commercialPricing?.discountLimitBps ?? null,
        effectiveRecords: commercialPricing?.records || null,
        configurationError: commercialPricing?.configurationError || null,
        configurationErrorCode: commercialPricing?.configurationErrorCode || null,
      },
    },
    summary: buildWaterSummary({ restocks, sales, expenses, adjustments }),
    restocks,
    sales,
    expenses,
    adjustments,
  });
};

const getStoredDiscountInputValue = (discountType, discountValue) => {
  const storedValue = Number(discountValue) || 0;
  if (discountType === "amount") return storedValue / 100;
  if (discountType === "percent") return storedValue / 100;
  return "";
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  const json = (statusCode, body, options = {}) =>
    respond(event, statusCode, body, { methods: WATER_METHODS, ...options });

  if (method === "OPTIONS") {
    return json(204, {});
  }

  if (method !== "GET" && method !== "POST") {
    return json(405, { error: "Method Not Allowed" });
  }

  if (
    method === "POST"
    && Buffer.byteLength(typeof event.body === "string" ? event.body : "", "utf8")
      > MAX_WATER_BODY_BYTES
  ) {
    return json(413, { error: "Water request body exceeds the 16 KB limit." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult = await requireInternalUser(client, event, {
      methods: WATER_METHODS,
      roles: WATER_ALLOWED_ROLES,
      permission: method === "GET" ? "water:read" : "water:write",
      roleError: "Only explicitly authorized Water operators, owners, and admins can access the Water module.",
      permissionError: "Explicit Water Business permission is required.",
    });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const { authUser, organizationId } = authResult;

    if (method === "GET") {
      const readRateLimit = await enforceWaterRateLimit(client, event, {
        organizationId,
        authUser,
        method,
      });
      if (!readRateLimit.allowed) {
        return json(
          429,
          { error: "Too many water requests. Try again shortly." },
          { extraHeaders: { "Retry-After": String(readRateLimit.retryAfterSeconds) } }
        );
      }

      await ensureTables(client);
      return json(200, await buildDashboard(client, organizationId));
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    const rawAction = cleanText(payload.action, MAX_ACTION_LENGTH).toLowerCase();
    const action = normalizeWaterAction(rawAction);
    const normalizedAction = action || "unknown";
    const writeRateLimit = await enforceWaterRateLimit(client, event, {
      organizationId,
      authUser,
      method,
      action: normalizedAction,
    });
    if (!writeRateLimit.allowed) {
      return json(
        429,
        { error: "Too many water updates. Try again shortly." },
        { extraHeaders: { "Retry-After": String(writeRateLimit.retryAfterSeconds) } }
      );
    }

    if (!action) {
      return json(400, { error: "Action is required." });
    }
    if (!WATER_ACTIONS.has(action)) {
      return json(400, { error: "Unsupported action." });
    }

    await ensureTables(client);
    const createdByUserId = Number.isFinite(Number(authUser.id)) ? Number(authUser.id) : null;
    const createdByName =
      cleanText(authUser.fullName, MAX_NAME_LENGTH)
      || cleanText(authUser.email, MAX_NAME_LENGTH)
      || "Water user";

    if (action === "restock") {
      const quantity = parsePositiveInteger(payload.quantity);
      const unitCost = resolveWaterRestockUnitCost(payload);
      const date = parseDate(payload.date);
      const vendorIdCandidate = Number(payload.vendorId);
      const vendorId =
        Number.isFinite(vendorIdCandidate) && vendorIdCandidate > 0 ? vendorIdCandidate : null;
      const vendorName = cleanText(payload.vendorName, MAX_VENDOR_NAME_LENGTH) || null;
      const notes = cleanText(payload.notes, MAX_NOTES_LENGTH) || null;

      if (!quantity) return json(400, { error: "Restock quantity must be greater than zero." });
      if (!unitCost) return json(400, { error: "Restock cost price must be greater than zero." });
      if (!date) return json(400, { error: "A valid restock date is required." });

      await runWaterTransaction(client, async () => {
        await lockWaterInventory(client, organizationId);
        await client.query(
          `INSERT INTO "waterRestock" (
          "organizationId",
          "productKey",
          "productName",
          "quantity",
          "unitCost",
          "vendorId",
          "vendorName",
          "notes",
          "date",
          "createdByUserId",
          "createdByName"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            organizationId,
            PRODUCT_KEY,
            PRODUCT_NAME,
            quantity,
            unitCost,
            vendorId,
            vendorName,
            notes,
            date,
            createdByUserId,
            createdByName,
          ]
        );
        await restateWaterSaleCostSnapshots(client, {
          organizationId,
          productKey: PRODUCT_KEY,
          userId: createdByUserId,
          userName: createdByName,
        });
      });

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "update_restock") {
      const restockId = Number(payload.restockId ?? payload.id);
      if (!Number.isFinite(restockId) || restockId <= 0) {
        return json(400, { error: "Valid restock id is required." });
      }

      const existingRes = await client.query(
        `SELECT
           id,
           "productKey",
           quantity,
           "unitCost",
           "vendorId",
           "vendorName",
           notes,
           date
         FROM "waterRestock"
         WHERE id = $1 AND "organizationId" = $2
         LIMIT 1`,
        [restockId, organizationId]
      );

      if (existingRes.rowCount === 0) {
        return json(404, { error: "Water restock not found." });
      }

      const existingRestock = existingRes.rows?.[0] || null;
      const quantity = parsePositiveInteger(payload.quantity ?? existingRestock.quantity);
      const unitCost = resolveWaterRestockUnitCost(payload, existingRestock.unitCost);
      const requestedVendorId = Object.prototype.hasOwnProperty.call(payload, "vendorId")
        ? Number(payload.vendorId)
        : Number(existingRestock.vendorId);
      const vendorId =
        Number.isFinite(requestedVendorId) && requestedVendorId > 0 ? requestedVendorId : null;
      const vendorName = cleanText(
        Object.prototype.hasOwnProperty.call(payload, "vendorName")
          ? payload.vendorName
          : existingRestock.vendorName,
        MAX_VENDOR_NAME_LENGTH
      ) || null;
      const notes = Object.prototype.hasOwnProperty.call(payload, "notes")
        ? cleanText(payload.notes, MAX_NOTES_LENGTH) || null
        : cleanText(existingRestock.notes, MAX_NOTES_LENGTH) || null;
      const date = parseDate(payload.date || existingRestock.date);

      if (!quantity) return json(400, { error: "Restock quantity must be greater than zero." });
      if (!unitCost) return json(400, { error: "Restock cost price must be greater than zero." });
      if (!date) return json(400, { error: "A valid restock date is required." });

      const dashboard = await buildDashboard(client, organizationId, {
        includeLinkedProduct: false,
        includePricing: false,
      });
      const stockWithoutExisting = dashboard.summary.stockOnHand - toAmount(existingRestock.quantity);
      if (stockWithoutExisting + quantity < 0) {
        return json(400, { error: "Restock update would push stock below zero." });
      }

      await runWaterTransaction(client, async () => {
        await lockWaterInventory(client, organizationId);
        const lockedRestockRes = await client.query(
          `SELECT "productKey", quantity, "unitCost", "vendorId", "vendorName", notes, date
           FROM "waterRestock"
           WHERE id = $1 AND "organizationId" = $2
           FOR UPDATE`,
          [restockId, organizationId]
        );
        if (lockedRestockRes.rowCount === 0) {
          const missingError = new Error("Water restock not found.");
          missingError.statusCode = 404;
          throw missingError;
        }
        const lockedRestock = lockedRestockRes.rows[0];
        if (
          String(lockedRestock.productKey || "") !== String(existingRestock.productKey || "")
          || Number(lockedRestock.quantity) !== Number(existingRestock.quantity)
          || Number(lockedRestock.unitCost) !== Number(existingRestock.unitCost)
          || Number(lockedRestock.vendorId || 0) !== Number(existingRestock.vendorId || 0)
          || String(lockedRestock.vendorName || "") !== String(existingRestock.vendorName || "")
          || String(lockedRestock.notes || "") !== String(existingRestock.notes || "")
          || new Date(lockedRestock.date).getTime() !== new Date(existingRestock.date).getTime()
        ) {
          const conflictError = new Error("This Water restock changed. Refresh it before saving again.");
          conflictError.statusCode = 409;
          conflictError.code = "WATER_RECORD_CHANGED";
          throw conflictError;
        }
        const lockedDashboard = await buildDashboard(client, organizationId, {
          includeLinkedProduct: false,
          includePricing: false,
        });
        const lockedStockWithoutExisting =
          lockedDashboard.summary.stockOnHand - toAmount(existingRestock.quantity);
        if (lockedStockWithoutExisting + quantity < 0) {
          const stockError = new Error("Restock update would push stock below zero.");
          stockError.statusCode = 400;
          stockError.code = "INVALID_WATER_STOCK";
          throw stockError;
        }
        await client.query(
          `UPDATE "waterRestock"
           SET "quantity" = $3,
               "unitCost" = $4,
               "vendorId" = $5,
               "vendorName" = $6,
               "notes" = $7,
               "date" = $8
           WHERE id = $1 AND "organizationId" = $2`,
          [restockId, organizationId, quantity, unitCost, vendorId, vendorName, notes, date]
        );

        const costBasisChanged = unitCost !== Number(existingRestock.unitCost)
          || new Date(date).getTime() !== new Date(existingRestock.date).getTime();
        if (costBasisChanged) {
          const restatedSaleCostCount = await restateWaterSaleCostSnapshots(client, {
            organizationId,
            productKey: existingRestock.productKey,
            userId: createdByUserId,
            userName: createdByName,
          });
          await writeAuditLog(client, {
            organizationId,
            userId: createdByUserId,
            action: "WATER_RESTOCK_COST_BASIS_CORRECTED",
            targetType: "waterRestock",
            targetId: String(restockId),
            category: "finance",
            severity: "warning",
            status: "ok",
            summary: "A historical Water restock cost basis was corrected.",
            actorLabel: createdByName,
            requestId: getEventHeader(event, "x-request-id"),
            ipAddress: getEventIpAddress(event),
            metadata: {
              businessUnit: COMMERCIAL_BUSINESS_UNITS.WATER,
              productKey: existingRestock.productKey,
              previousUnitCost: Number(existingRestock.unitCost),
              newUnitCost: unitCost,
              previousDate: existingRestock.date,
              newDate: date,
              quantity,
              restatedSaleCostCount,
            },
          });
        }
      });

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "update_product_pricing") {
      return json(410, {
        error:
          "Water prices are effective-dated commercial records. Schedule the price in Commercial Settings.",
        code: "WATER_PRICE_SETTINGS_REQUIRED",
      });
    }

    if (action === "delete_restock") {
      const restockId = Number(payload.restockId ?? payload.id);
      if (!Number.isFinite(restockId) || restockId <= 0) {
        return json(400, { error: "Valid restock id is required." });
      }

      await runWaterTransaction(client, async () => {
        await lockWaterInventory(client, organizationId);
        const existingRes = await client.query(
          `SELECT id, "productKey", quantity
           FROM "waterRestock"
           WHERE id = $1 AND "organizationId" = $2
           FOR UPDATE`,
          [restockId, organizationId]
        );
        if (existingRes.rowCount === 0) {
          const missingError = new Error("Water restock not found.");
          missingError.statusCode = 404;
          throw missingError;
        }
        const existingRestock = existingRes.rows[0];
        const dashboard = await buildDashboard(client, organizationId, {
          includeLinkedProduct: false,
          includePricing: false,
        });
        const stockWithoutExisting = dashboard.summary.stockOnHand - toAmount(existingRestock.quantity);
        if (stockWithoutExisting < 0) {
          const stockError = new Error("Undoing this restock would push stock below zero.");
          stockError.statusCode = 400;
          stockError.code = "INVALID_WATER_STOCK";
          throw stockError;
        }
        await client.query(
          `DELETE FROM "waterRestock"
           WHERE id = $1 AND "organizationId" = $2`,
          [restockId, organizationId]
        );
        await restateWaterSaleCostSnapshots(client, {
          organizationId,
          productKey: existingRestock.productKey,
          userId: createdByUserId,
          userName: createdByName,
        });
      });

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "sale") {
      const quantity = parsePositiveInteger(payload.quantity);
      const saleChannel = normalizeChannel(payload.saleChannel);
      const paymentMethod = normalizePaymentMethod(payload.paymentMethod);
      const paymentStatus = normalizePaymentStatus(payload.paymentStatus, paymentMethod);
      const discountType = normalizeDiscountType(payload.discountType);
      const hasSubmittedUnitPrice = Object.prototype.hasOwnProperty.call(payload, "unitPrice");
      const submittedUnitPrice = hasSubmittedUnitPrice
        ? parseMoney(payload.unitPrice)
        : null;
      const requestedCustomerId = Number(payload.customerId);
      let customerId =
        Number.isFinite(requestedCustomerId) && requestedCustomerId > 0 ? requestedCustomerId : null;
      let customerName = cleanText(payload.customerName, MAX_NAME_LENGTH) || null;
      const customerPhone = cleanText(payload.customerPhone, MAX_PHONE_LENGTH) || null;
      const notes = cleanText(payload.notes, MAX_NOTES_LENGTH) || null;
      const providerReference = cleanText(payload.providerReference, MAX_REFERENCE_LENGTH) || null;
      const date = parseDate(payload.date);
      const paidAt = paymentStatus === "paid" ? parseDate(payload.paidAt || payload.date) : null;

      if (!quantity) return json(400, { error: "Sale quantity must be greater than zero." });
      if (!date) return json(400, { error: "A valid sale date is required." });
      const commercialAt = resolveWaterCommercialTimestamp(date);
      if (hasSubmittedUnitPrice && !submittedUnitPrice) {
        return json(400, { error: "Sale price must be greater than zero." });
      }
      if (!customerName && !customerId) {
        return json(400, { error: "Customer name is required for every water sale." });
      }

      if (customerId) {
        const customerRes = await client.query(
          `SELECT id, name, phone
           FROM "customer"
           WHERE id = $1 AND "organizationId" = $2
           LIMIT 1`,
          [customerId, organizationId]
        );
        if (customerRes.rowCount === 0) {
          return json(404, { error: "Linked REEBS customer not found." });
        }
        const linkedCustomer = customerRes.rows[0] || null;
        customerName = cleanText(linkedCustomer?.name, MAX_NAME_LENGTH) || customerName;
        if (customerPhone && cleanText(linkedCustomer?.phone, MAX_PHONE_LENGTH) !== customerPhone) {
          await updateCustomerPhone(client, organizationId, customerId, customerPhone);
        }
      } else if (customerName) {
        const resolvedCustomer = await findOrCreateCustomerByName(
          client,
          organizationId,
          customerName,
          customerPhone
        );
        customerId = Number(resolvedCustomer?.id) || null;
        customerName = cleanText(resolvedCustomer?.name, MAX_NAME_LENGTH) || customerName;
      }

      const dashboard = await buildDashboard(client, organizationId, {
        includeLinkedProduct: false,
        includePricing: false,
      });
      if (quantity > dashboard.summary.stockOnHand) {
        return json(400, { error: "Not enough 15pk Gwater in stock for this sale." });
      }

      const saleId = await runWaterTransaction(client, async () => {
        await lockWaterSaleCommercialTerms(client, {
          organizationId,
          saleChannel,
          includeDiscount: true,
        });
        await lockWaterInventory(client, organizationId);
        const [standardPriceRecord, maximumDiscountBps, lockedUnitCostAtSaleCents] =
          await Promise.all([
            resolveWaterSalePrice(client, {
              organizationId,
              productKey: PRODUCT_KEY,
              saleChannel,
              quantity,
              at: commercialAt,
            }),
            resolveCommercialValue(client, {
              organizationId,
              businessUnit: COMMERCIAL_BUSINESS_UNITS.WATER,
              key: COMMERCIAL_CONFIG_KEYS.WATER_DISCOUNT_LIMIT_BPS,
              at: commercialAt,
            }),
            resolveWaterUnitCostAtSale(client, organizationId, date, PRODUCT_KEY),
          ]);
        const priceDecision = resolveWaterPriceDecision({
          standardPriceCents: standardPriceRecord.priceCents,
          submittedPriceCents: submittedUnitPrice,
          hasSubmittedPrice: hasSubmittedUnitPrice,
          canOverride: hasPermission(authUser, "water-pricing:manage"),
          overrideReason: payload.priceOverrideReason,
        });
        if (priceDecision.error) {
          const priceError = new Error(priceDecision.error);
          priceError.statusCode = priceDecision.statusCode || 400;
          if (priceDecision.statusCode === 403) {
            priceError.code = "WATER_PRICE_OVERRIDE_FORBIDDEN";
          }
          throw priceError;
        }
        const unitPrice = priceDecision.unitPrice;
        const subtotalAmount = unitPrice * quantity;
        const discountDetails = resolveSaleDiscount(
          discountType,
          payload.discountValue,
          subtotalAmount,
          maximumDiscountBps
        );
        if (discountDetails.error) {
          const discountError = new Error(discountDetails.error);
          discountError.statusCode = 400;
          throw discountError;
        }
        const totalAmount = subtotalAmount - discountDetails.discountAmount;
        const lockedDashboard = await buildDashboard(client, organizationId, {
          includeLinkedProduct: false,
          includePricing: false,
        });
        if (quantity > lockedDashboard.summary.stockOnHand) {
          const stockError = new Error("Not enough 15pk Gwater in stock for this sale.");
          stockError.statusCode = 400;
          stockError.code = "INSUFFICIENT_WATER_STOCK";
          throw stockError;
        }
        const insertResult = await client.query(
          `INSERT INTO "waterSale" (
          "organizationId",
          "productKey",
          "productName",
          "quantity",
          "saleChannel",
          "paymentMethod",
          "paymentStatus",
          "discountType",
          "discountValue",
          "discountAmount",
          "unitPrice",
          "standardUnitPrice",
          "waterProductPriceId",
          "priceOverrideReason",
          "priceOverriddenByUserId",
          "priceOverriddenAt",
          "unitCostAtSaleCents",
          "totalAmount",
          "customerId",
          "customerName",
          "providerReference",
          "notes",
          "date",
          "paidAt",
          "createdByUserId",
          "createdByName"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26
        )
          RETURNING id`,
          [
          organizationId,
          PRODUCT_KEY,
          PRODUCT_NAME,
          quantity,
          saleChannel,
          paymentMethod,
          paymentStatus,
          discountDetails.discountType,
          discountDetails.discountValue,
          discountDetails.discountAmount,
          unitPrice,
          priceDecision.standardUnitPrice,
          Number(standardPriceRecord.id),
          priceDecision.overrideReason,
          priceDecision.isOverride ? createdByUserId : null,
          priceDecision.isOverride ? new Date().toISOString() : null,
          lockedUnitCostAtSaleCents,
          totalAmount,
          customerId,
          customerName,
          providerReference,
          notes,
          date,
          paidAt,
          createdByUserId,
            createdByName,
          ]
        );

        const insertedSaleId = Number(insertResult.rows?.[0]?.id);
        if (Number.isFinite(insertedSaleId) && insertedSaleId > 0) {
          await client.query(
            `UPDATE "waterSale"
             SET "paymentReference" = $2
             WHERE id = $1 AND "organizationId" = $3`,
            [
              insertedSaleId,
              buildPaymentReference(organizationId, insertedSaleId),
              organizationId,
            ]
          );
          if (priceDecision.isOverride) {
            await auditWaterPriceOverride(client, event, {
              organizationId,
              authUser,
              saleId: insertedSaleId,
              standardUnitPrice: priceDecision.standardUnitPrice,
              overrideUnitPrice: unitPrice,
              reason: priceDecision.overrideReason,
              action: "WATER_SALE_PRICE_OVERRIDDEN",
            });
          }
        }
        return insertedSaleId;
      });

      if (!Number.isFinite(saleId) || saleId <= 0) {
        throw new Error("Water sale could not be recorded.");
      }

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "update_sale") {
      const saleId = Number(payload.saleId ?? payload.id);
      if (!Number.isFinite(saleId) || saleId <= 0) {
        return json(400, { error: "Valid sale id is required." });
      }

      const existingRes = await client.query(
        `SELECT
           id,
           quantity,
           "saleChannel",
           "paymentMethod",
           "paymentStatus",
           "discountType",
           "discountValue",
           "unitPrice",
           "standardUnitPrice",
           "waterProductPriceId",
           "priceOverrideReason",
           "priceOverriddenByUserId",
           "priceOverriddenAt",
           "unitCostAtSaleCents",
           "customerId",
           "customerName",
           "paymentReference",
           "providerReference",
           notes,
           date,
           "paidAt",
           "updatedAt"
         FROM "waterSale"
         WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL
         LIMIT 1`,
        [saleId, organizationId]
      );

      if (existingRes.rowCount === 0) {
        return json(404, { error: "Water order not found." });
      }

      const existingSale = existingRes.rows?.[0] || null;
      const quantity = parsePositiveInteger(payload.quantity ?? existingSale.quantity);
      const saleChannel = normalizeChannel(payload.saleChannel ?? existingSale.saleChannel);
      const paymentMethod = normalizePaymentMethod(payload.paymentMethod ?? existingSale.paymentMethod);
      const paymentStatus = normalizePaymentStatus(
        payload.paymentStatus ?? existingSale.paymentStatus,
        paymentMethod
      );
      const discountType = normalizeDiscountType(payload.discountType ?? existingSale.discountType);
      const discountInput = Object.prototype.hasOwnProperty.call(payload, "discountValue")
        ? payload.discountValue
        : getStoredDiscountInputValue(discountType, existingSale.discountValue);
      const hasSubmittedUnitPrice = Object.prototype.hasOwnProperty.call(payload, "unitPrice");
      const submittedUnitPrice = hasSubmittedUnitPrice
        ? parseMoney(payload.unitPrice)
        : null;
      if (hasSubmittedUnitPrice && !submittedUnitPrice) {
        return json(400, { error: "Sale price must be greater than zero." });
      }
      const existingUnitPrice = Math.max(0, Math.round(Number(existingSale.unitPrice) || 0));
      const submittedPriceChanged = hasSubmittedUnitPrice && submittedUnitPrice !== existingUnitPrice;
      let standardUnitPrice = Math.max(
        0,
        Math.round(Number(existingSale.standardUnitPrice) || existingUnitPrice)
      );
      let unitPrice = existingUnitPrice;
      let waterProductPriceId = Number(existingSale.waterProductPriceId) || null;
      let unitCostAtSaleCents = Number(existingSale.unitCostAtSaleCents) || null;
      let priceOverrideReason = cleanText(
        existingSale.priceOverrideReason,
        MAX_PRICE_OVERRIDE_REASON_LENGTH
      ) || null;
      let priceOverriddenByUserId = Number(existingSale.priceOverriddenByUserId) || null;
      let priceOverriddenAt = existingSale.priceOverriddenAt || null;
      const requestedCustomerId = Object.prototype.hasOwnProperty.call(payload, "customerId")
        ? Number(payload.customerId)
        : Number(existingSale.customerId);
      let customerId =
        Number.isFinite(requestedCustomerId) && requestedCustomerId > 0 ? requestedCustomerId : null;
      let customerName = cleanText(
        Object.prototype.hasOwnProperty.call(payload, "customerName")
          ? payload.customerName
          : existingSale.customerName,
        MAX_NAME_LENGTH
      ) || null;
      const customerPhone = cleanText(payload.customerPhone, MAX_PHONE_LENGTH) || null;
      const providerReference = cleanText(
        Object.prototype.hasOwnProperty.call(payload, "providerReference")
          ? payload.providerReference
          : existingSale.providerReference,
        MAX_REFERENCE_LENGTH
      ) || null;
      const notes = Object.prototype.hasOwnProperty.call(payload, "notes")
        ? cleanText(payload.notes, MAX_NOTES_LENGTH) || null
        : cleanText(existingSale.notes, MAX_NOTES_LENGTH) || null;
      const date = parseDate(payload.date || existingSale.date);
      const paidAt =
        paymentStatus === "paid"
          ? parseDate(payload.paidAt || existingSale.paidAt || payload.date || existingSale.date)
          : null;

      if (!quantity) return json(400, { error: "Sale quantity must be greater than zero." });
      if (!date) return json(400, { error: "A valid sale date is required." });
      const commercialAt = resolveWaterCommercialTimestamp(date);
      if (!customerName && !customerId) {
        return json(400, { error: "Customer name is required for every water order." });
      }

      if (customerId) {
        const customerRes = await client.query(
          `SELECT id, name, phone
           FROM "customer"
           WHERE id = $1 AND "organizationId" = $2
           LIMIT 1`,
          [customerId, organizationId]
        );
        if (customerRes.rowCount === 0) {
          return json(404, { error: "Linked REEBS customer not found." });
        }
        const linkedCustomer = customerRes.rows?.[0] || null;
        customerName = cleanText(linkedCustomer?.name, MAX_NAME_LENGTH) || customerName;
        if (customerPhone && cleanText(linkedCustomer?.phone, MAX_PHONE_LENGTH) !== customerPhone) {
          await updateCustomerPhone(client, organizationId, customerId, customerPhone);
        }
      } else if (customerName) {
        const resolvedCustomer = await findOrCreateCustomerByName(
          client,
          organizationId,
          customerName,
          customerPhone
        );
        customerId = Number(resolvedCustomer?.id) || null;
        customerName = cleanText(resolvedCustomer?.name, MAX_NAME_LENGTH) || customerName;
      }

      const dashboard = await buildDashboard(client, organizationId, {
        includeLinkedProduct: false,
        includePricing: false,
      });
      const availableStock = dashboard.summary.stockOnHand + toAmount(existingSale.quantity);
      if (quantity > availableStock) {
        return json(400, { error: "Not enough 15pk Gwater in stock for this order." });
      }

      const pricingBasisChanged = didWaterSalePricingBasisChange(existingSale, {
        quantity,
        saleChannel,
        date,
      });
      const pricingResolutionRequired = pricingBasisChanged || submittedPriceChanged;
      let recordedPriceOverride = false;
      if (!unitPrice) return json(400, { error: "Sale price must be greater than zero." });

      const commercialTermsChanged = pricingResolutionRequired
        || Object.prototype.hasOwnProperty.call(payload, "discountType")
        || Object.prototype.hasOwnProperty.call(payload, "discountValue");
      let discountDetails = null;
      let totalAmount = null;

      await runWaterTransaction(client, async () => {
        await lockWaterSaleCommercialTerms(client, {
          organizationId,
          saleChannel,
          includePricing: pricingResolutionRequired,
          includeDiscount: commercialTermsChanged,
        });
        await lockWaterInventory(client, organizationId);
        const lockedSaleRes = await client.query(
          `SELECT quantity, "unitPrice", "saleChannel", date, "updatedAt"
           FROM "waterSale"
           WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL
           FOR UPDATE`,
          [saleId, organizationId]
        );
        if (lockedSaleRes.rowCount === 0) {
          const missingError = new Error("Water order not found.");
          missingError.statusCode = 404;
          throw missingError;
        }
        const lockedSale = lockedSaleRes.rows[0];
        if (
          Number(lockedSale.quantity) !== Number(existingSale.quantity)
          || Number(lockedSale.unitPrice) !== Number(existingSale.unitPrice)
          || normalizeChannel(lockedSale.saleChannel) !== normalizeChannel(existingSale.saleChannel)
          || new Date(lockedSale.date).getTime() !== new Date(existingSale.date).getTime()
          || new Date(lockedSale.updatedAt || 0).getTime()
            !== new Date(existingSale.updatedAt || 0).getTime()
        ) {
          const conflictError = new Error("This Water order changed. Refresh it before saving again.");
          conflictError.statusCode = 409;
          conflictError.code = "WATER_RECORD_CHANGED";
          throw conflictError;
        }
        if (pricingResolutionRequired) {
          const [standardPriceRecord, resolvedUnitCostAtSaleCents] = await Promise.all([
            resolveWaterSalePrice(client, {
              organizationId,
              productKey: PRODUCT_KEY,
              saleChannel,
              quantity,
              at: commercialAt,
            }),
            resolveWaterUnitCostAtSale(client, organizationId, date, PRODUCT_KEY),
          ]);
          const priceDecision = resolveWaterPriceDecision({
            standardPriceCents: standardPriceRecord.priceCents,
            submittedPriceCents: submittedUnitPrice,
            hasSubmittedPrice: submittedPriceChanged,
            canOverride: hasPermission(authUser, "water-pricing:manage"),
            overrideReason: payload.priceOverrideReason,
          });
          if (priceDecision.error) {
            const priceError = new Error(priceDecision.error);
            priceError.statusCode = priceDecision.statusCode || 400;
            if (priceDecision.statusCode === 403) {
              priceError.code = "WATER_PRICE_OVERRIDE_FORBIDDEN";
            }
            throw priceError;
          }
          unitPrice = priceDecision.unitPrice;
          standardUnitPrice = priceDecision.standardUnitPrice;
          waterProductPriceId = Number(standardPriceRecord.id) || null;
          unitCostAtSaleCents = resolvedUnitCostAtSaleCents;
          recordedPriceOverride = priceDecision.isOverride;
          priceOverrideReason = priceDecision.overrideReason;
          priceOverriddenByUserId = priceDecision.isOverride ? createdByUserId : null;
          priceOverriddenAt = priceDecision.isOverride ? new Date().toISOString() : null;
        }
        const maximumDiscountBps = commercialTermsChanged
          ? await resolveCommercialValue(client, {
            organizationId,
            businessUnit: COMMERCIAL_BUSINESS_UNITS.WATER,
            key: COMMERCIAL_CONFIG_KEYS.WATER_DISCOUNT_LIMIT_BPS,
            at: commercialAt,
          })
          : null;
        const subtotalAmount = unitPrice * quantity;
        discountDetails = resolveSaleDiscount(
          discountType,
          discountInput,
          subtotalAmount,
          maximumDiscountBps
        );
        if (discountDetails.error) {
          const discountError = new Error(discountDetails.error);
          discountError.statusCode = 400;
          throw discountError;
        }
        totalAmount = subtotalAmount - discountDetails.discountAmount;
        const lockedDashboard = await buildDashboard(client, organizationId, {
          includeLinkedProduct: false,
          includePricing: false,
        });
        const lockedAvailableStock =
          lockedDashboard.summary.stockOnHand + toAmount(existingSale.quantity);
        if (quantity > lockedAvailableStock) {
          const stockError = new Error("Not enough 15pk Gwater in stock for this order.");
          stockError.statusCode = 400;
          stockError.code = "INSUFFICIENT_WATER_STOCK";
          throw stockError;
        }
        await client.query(
          `UPDATE "waterSale"
         SET "quantity" = $3,
             "saleChannel" = $4,
             "paymentMethod" = $5,
             "paymentStatus" = $6,
             "discountType" = $7,
             "discountValue" = $8,
             "discountAmount" = $9,
             "unitPrice" = $10,
             "standardUnitPrice" = $11,
             "waterProductPriceId" = $12,
             "unitCostAtSaleCents" = $13,
             "priceOverrideReason" = $14,
             "priceOverriddenByUserId" = $15,
             "priceOverriddenAt" = $16,
             "totalAmount" = $17,
             "customerId" = $18,
             "customerName" = $19,
             "providerReference" = $20,
             "notes" = $21,
             "date" = $22,
             "paidAt" = $23,
             "updatedAt" = NOW(),
             "updatedByUserId" = $24,
             "updatedByName" = $25
           WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL`,
          [
          saleId,
          organizationId,
          quantity,
          saleChannel,
          paymentMethod,
          paymentStatus,
          discountDetails.discountType,
          discountDetails.discountValue,
          discountDetails.discountAmount,
          unitPrice,
          standardUnitPrice,
          waterProductPriceId,
          unitCostAtSaleCents,
          priceOverrideReason,
          priceOverriddenByUserId,
          priceOverriddenAt,
          totalAmount,
          customerId,
          customerName,
          providerReference,
          notes,
          date,
          paidAt,
          createdByUserId,
            createdByName,
          ]
        );

        if (recordedPriceOverride) {
          await auditWaterPriceOverride(client, event, {
            organizationId,
            authUser,
            saleId,
            standardUnitPrice,
            overrideUnitPrice: unitPrice,
            reason: priceOverrideReason,
            action: "WATER_SALE_PRICE_CHANGED",
          });
        } else if (
          pricingResolutionRequired
          && (
            unitPrice !== existingUnitPrice
            || standardUnitPrice !== Number(existingSale.standardUnitPrice)
            || waterProductPriceId !== Number(existingSale.waterProductPriceId)
          )
        ) {
          await writeAuditLog(client, {
            organizationId,
            userId: createdByUserId,
            action: "WATER_SALE_PRICE_RECALCULATED",
            targetType: "waterSale",
            targetId: String(saleId),
            category: "finance",
            severity: "info",
            status: "ok",
            summary: "Water sale pricing was recalculated after its pricing basis changed.",
            actorLabel: createdByName,
            requestId: getEventHeader(event, "x-request-id"),
            ipAddress: getEventIpAddress(event),
            metadata: {
              businessUnit: COMMERCIAL_BUSINESS_UNITS.WATER,
              previousUnitPrice: existingUnitPrice,
              newUnitPrice: unitPrice,
              previousStandardUnitPrice: Number(existingSale.standardUnitPrice) || existingUnitPrice,
              newStandardUnitPrice: standardUnitPrice,
              previousQuantity: Number(existingSale.quantity),
              newQuantity: quantity,
              previousSaleChannel: normalizeChannel(existingSale.saleChannel),
              newSaleChannel: saleChannel,
              previousDate: existingSale.date,
              newDate: date,
              waterProductPriceId,
            },
          });
        }

        if (!cleanText(existingSale.paymentReference, MAX_REFERENCE_LENGTH)) {
          await client.query(
            `UPDATE "waterSale"
             SET "paymentReference" = $2
             WHERE id = $1 AND "organizationId" = $3`,
            [saleId, buildPaymentReference(organizationId, saleId), organizationId]
          );
        }
      });

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "delete_sale") {
      const saleId = Number(payload.saleId ?? payload.id);
      if (!Number.isFinite(saleId) || saleId <= 0) {
        return json(400, { error: "Valid sale id is required." });
      }

      await runWaterTransaction(client, async () => {
        await lockWaterInventory(client, organizationId);
        const existingRes = await client.query(
          `SELECT id
           FROM "waterSale"
           WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL
           FOR UPDATE`,
          [saleId, organizationId]
        );
        if (existingRes.rowCount === 0) {
          const missingError = new Error("Water order not found.");
          missingError.statusCode = 404;
          throw missingError;
        }
        await client.query(
          `UPDATE "waterSale"
           SET "archivedAt" = NOW(),
               "archivedByUserId" = $3,
               "archivedByName" = $4,
               "updatedAt" = NOW(),
               "updatedByUserId" = $3,
               "updatedByName" = $4
           WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL`,
          [saleId, organizationId, createdByUserId, createdByName]
        );
      });

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "expense") {
      const category = cleanText(payload.category, MAX_CATEGORY_LENGTH);
      const description = cleanText(payload.description, MAX_DESCRIPTION_LENGTH);
      const amount = parseMoney(payload.amount);
      const notes = cleanText(payload.notes, MAX_NOTES_LENGTH) || null;
      const date = parseDate(payload.date);

      if (!category) return json(400, { error: "Expense category is required." });
      if (!description) return json(400, { error: "Expense description is required." });
      if (!amount) return json(400, { error: "Expense amount must be greater than zero." });
      if (!date) return json(400, { error: "A valid expense date is required." });

      await client.query(
        `INSERT INTO "waterExpense" (
          "organizationId",
          "category",
          "amount",
          "description",
          "notes",
          "date",
          "createdByUserId",
          "createdByName"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [organizationId, category, amount, description, notes, date, createdByUserId, createdByName]
      );

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "update_expense") {
      const expenseId = Number(payload.expenseId ?? payload.id);
      if (!Number.isFinite(expenseId) || expenseId <= 0) {
        return json(400, { error: "Valid expense id is required." });
      }

      const existingRes = await client.query(
        `SELECT
           id,
           category,
           amount,
           description,
           notes,
           date
         FROM "waterExpense"
         WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL
         LIMIT 1`,
        [expenseId, organizationId]
      );

      if (existingRes.rowCount === 0) {
        return json(404, { error: "Water expense not found." });
      }

      const existingExpense = existingRes.rows?.[0] || null;
      const category = cleanText(
        Object.prototype.hasOwnProperty.call(payload, "category")
          ? payload.category
          : existingExpense.category,
        MAX_CATEGORY_LENGTH
      );
      const description = cleanText(
        Object.prototype.hasOwnProperty.call(payload, "description")
          ? payload.description
          : existingExpense.description,
        MAX_DESCRIPTION_LENGTH
      );
      const amount = Object.prototype.hasOwnProperty.call(payload, "amount")
        ? parseMoney(payload.amount)
        : Math.max(0, Number(existingExpense.amount) || 0);
      const notes = Object.prototype.hasOwnProperty.call(payload, "notes")
        ? cleanText(payload.notes, MAX_NOTES_LENGTH) || null
        : cleanText(existingExpense.notes, MAX_NOTES_LENGTH) || null;
      const date = parseDate(payload.date || existingExpense.date);

      if (!category) return json(400, { error: "Expense category is required." });
      if (!description) return json(400, { error: "Expense description is required." });
      if (!amount) return json(400, { error: "Expense amount must be greater than zero." });
      if (!date) return json(400, { error: "A valid expense date is required." });

      await client.query(
        `UPDATE "waterExpense"
         SET "category" = $3,
             "amount" = $4,
             "description" = $5,
             "notes" = $6,
             "date" = $7
         WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL`,
        [expenseId, organizationId, category, amount, description, notes, date]
      );

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "delete_expense") {
      const expenseId = Number(payload.expenseId ?? payload.id);
      if (!Number.isFinite(expenseId) || expenseId <= 0) {
        return json(400, { error: "Valid expense id is required." });
      }

      const existingRes = await client.query(
        `SELECT id
         FROM "waterExpense"
         WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL
         LIMIT 1`,
        [expenseId, organizationId]
      );

      if (existingRes.rowCount === 0) {
        return json(404, { error: "Water expense not found." });
      }

      await client.query(
        `UPDATE "waterExpense"
         SET "archivedAt" = NOW(),
             "archivedByUserId" = $3,
             "archivedByName" = $4
         WHERE id = $1 AND "organizationId" = $2 AND "archivedAt" IS NULL`,
        [expenseId, organizationId, createdByUserId, createdByName]
      );

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "adjustment") {
      const quantityDelta = parseSignedInteger(payload.quantityDelta);
      const reason = cleanText(payload.reason, MAX_REASON_LENGTH);
      const notes = cleanText(payload.notes, MAX_NOTES_LENGTH) || null;
      const date = parseDate(payload.date);

      if (!quantityDelta) return json(400, { error: "Stock correction cannot be zero." });
      if (!reason) return json(400, { error: "A reason is required for stock corrections." });
      if (!date) return json(400, { error: "A valid correction date is required." });

      await runWaterTransaction(client, async () => {
        await lockWaterInventory(client, organizationId);
        const dashboard = await buildDashboard(client, organizationId, {
          includeLinkedProduct: false,
          includePricing: false,
        });
        if (quantityDelta < 0 && Math.abs(quantityDelta) > dashboard.summary.stockOnHand) {
          const stockError = new Error("Stock correction would push quantity below zero.");
          stockError.statusCode = 400;
          stockError.code = "INVALID_WATER_STOCK";
          throw stockError;
        }
        await client.query(
          `INSERT INTO "waterAdjustment" (
          "organizationId",
          "productKey",
          "productName",
          "quantityDelta",
          "reason",
          "notes",
          "date",
          "createdByUserId",
          "createdByName"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            organizationId,
            PRODUCT_KEY,
            PRODUCT_NAME,
            quantityDelta,
            reason,
            notes,
            date,
            createdByUserId,
            createdByName,
          ]
        );
      });

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "update_adjustment") {
      const adjustmentId = Number(payload.adjustmentId ?? payload.id);
      if (!Number.isFinite(adjustmentId) || adjustmentId <= 0) {
        return json(400, { error: "Valid correction id is required." });
      }

      const existingRes = await client.query(
        `SELECT
           id,
           "quantityDelta",
           reason,
           notes,
           date
         FROM "waterAdjustment"
         WHERE id = $1 AND "organizationId" = $2
         LIMIT 1`,
        [adjustmentId, organizationId]
      );

      if (existingRes.rowCount === 0) {
        return json(404, { error: "Water correction not found." });
      }

      const existingAdjustment = existingRes.rows?.[0] || null;
      const quantityDelta = Object.prototype.hasOwnProperty.call(payload, "quantityDelta")
        ? parseSignedInteger(payload.quantityDelta)
        : parseSignedInteger(existingAdjustment.quantityDelta);
      const reason = cleanText(
        Object.prototype.hasOwnProperty.call(payload, "reason")
          ? payload.reason
          : existingAdjustment.reason,
        MAX_REASON_LENGTH
      );
      const notes = Object.prototype.hasOwnProperty.call(payload, "notes")
        ? cleanText(payload.notes, MAX_NOTES_LENGTH) || null
        : cleanText(existingAdjustment.notes, MAX_NOTES_LENGTH) || null;
      const date = parseDate(payload.date || existingAdjustment.date);

      if (!quantityDelta) return json(400, { error: "Stock correction cannot be zero." });
      if (!reason) return json(400, { error: "A reason is required for stock corrections." });
      if (!date) return json(400, { error: "A valid correction date is required." });

      await runWaterTransaction(client, async () => {
        await lockWaterInventory(client, organizationId);
        const lockedAdjustmentRes = await client.query(
          `SELECT "quantityDelta", reason, notes, date
           FROM "waterAdjustment"
           WHERE id = $1 AND "organizationId" = $2
           FOR UPDATE`,
          [adjustmentId, organizationId]
        );
        if (lockedAdjustmentRes.rowCount === 0) {
          const missingError = new Error("Water correction not found.");
          missingError.statusCode = 404;
          throw missingError;
        }
        const lockedAdjustment = lockedAdjustmentRes.rows[0];
        if (
          Number(lockedAdjustment.quantityDelta) !== Number(existingAdjustment.quantityDelta)
          || String(lockedAdjustment.reason || "") !== String(existingAdjustment.reason || "")
          || String(lockedAdjustment.notes || "") !== String(existingAdjustment.notes || "")
          || new Date(lockedAdjustment.date).getTime() !== new Date(existingAdjustment.date).getTime()
        ) {
          const conflictError = new Error("This Water correction changed. Refresh it before saving again.");
          conflictError.statusCode = 409;
          conflictError.code = "WATER_RECORD_CHANGED";
          throw conflictError;
        }
        const dashboard = await buildDashboard(client, organizationId, {
          includeLinkedProduct: false,
          includePricing: false,
        });
        const stockWithoutExisting =
          dashboard.summary.stockOnHand - toAmount(existingAdjustment.quantityDelta);
        if (stockWithoutExisting + quantityDelta < 0) {
          const stockError = new Error("Stock correction would push quantity below zero.");
          stockError.statusCode = 400;
          stockError.code = "INVALID_WATER_STOCK";
          throw stockError;
        }
        await client.query(
          `UPDATE "waterAdjustment"
           SET "quantityDelta" = $3,
               "reason" = $4,
               "notes" = $5,
               "date" = $6
           WHERE id = $1 AND "organizationId" = $2`,
          [adjustmentId, organizationId, quantityDelta, reason, notes, date]
        );
      });

      return json(200, await buildDashboard(client, organizationId));
    }

    if (action === "delete_adjustment") {
      const adjustmentId = Number(payload.adjustmentId ?? payload.id);
      if (!Number.isFinite(adjustmentId) || adjustmentId <= 0) {
        return json(400, { error: "Valid correction id is required." });
      }

      await runWaterTransaction(client, async () => {
        await lockWaterInventory(client, organizationId);
        const existingRes = await client.query(
          `SELECT id, "quantityDelta"
           FROM "waterAdjustment"
           WHERE id = $1 AND "organizationId" = $2
           FOR UPDATE`,
          [adjustmentId, organizationId]
        );
        if (existingRes.rowCount === 0) {
          const missingError = new Error("Water correction not found.");
          missingError.statusCode = 404;
          throw missingError;
        }
        const existingAdjustment = existingRes.rows[0];
        const dashboard = await buildDashboard(client, organizationId, {
          includeLinkedProduct: false,
          includePricing: false,
        });
        const stockWithoutExisting =
          dashboard.summary.stockOnHand - toAmount(existingAdjustment.quantityDelta);
        if (stockWithoutExisting < 0) {
          const stockError = new Error("Undoing this correction would push stock below zero.");
          stockError.statusCode = 400;
          stockError.code = "INVALID_WATER_STOCK";
          throw stockError;
        }
        await client.query(
          `DELETE FROM "waterAdjustment"
           WHERE id = $1 AND "organizationId" = $2`,
          [adjustmentId, organizationId]
        );
      });

      return json(200, await buildDashboard(client, organizationId));
    }

  } catch (err) {
    console.error("Water module error", err);
    const statusCode = Number(err?.statusCode);
    const safeStatusCode = Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
      ? statusCode
      : 500;
    return json(safeStatusCode, {
      error: safeStatusCode === 500
        ? "Failed to process water module request."
        : err.message,
      ...(err?.code ? { code: err.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
