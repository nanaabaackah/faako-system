/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import {
  COMMERCIAL_BUSINESS_UNITS,
  COMMERCIAL_CONFIG_DEFINITIONS,
  CommercialConfigurationError,
  buildCommercialRuleLockKey,
  buildEffectiveDatedOverlapPlan,
  buildWaterPriceLockKey,
  getCommercialConfigDefinition,
  normalizeCommercialBusinessUnit,
  normalizeCommercialConfigValue,
  normalizeEffectiveWindow,
  normalizeProductKey,
  normalizeWaterProductPriceInput,
  normalizeWaterPriceType,
  lockCommercialConfigurationKeys,
  selectSingleEffectiveRecord,
  serializeCommercialConfiguration,
  serializeWaterProductPrice,
} from "./_shared/commercialConfig.js";
import {
  hasPermission,
  normalizeRole,
  requireInternalUser,
  respond,
} from "./_shared/internalApi.js";
import {
  getEventHeader,
  getEventIpAddress,
  writeAuditLog,
} from "./_shared/auditLog.js";

const METHODS = "GET,POST,OPTIONS";
const RESOURCE_TYPES = Object.freeze({
  COMMERCIAL_RULE: "commercial_rule",
  WATER_PRICE: "water_price",
});
const MAX_LIST_ROWS = 1000;

const json = (event, statusCode, payload = {}) =>
  respond(event, statusCode, payload, { methods: METHODS });

const parseBody = (event) => {
  try {
    const parsed = JSON.parse(event.body || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeResourceType = (value) => {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "configuration" || normalized === "commercial_config") {
    return RESOURCE_TYPES.COMMERCIAL_RULE;
  }
  if (normalized === "water_product_price") return RESOURCE_TYPES.WATER_PRICE;
  if (Object.values(RESOURCE_TYPES).includes(normalized)) return normalized;
  const error = new Error("resourceType must be commercial_rule or water_price.");
  error.statusCode = 400;
  throw error;
};

export const canAccessCommercialConfigMethod = (user, method, resourceType = null) => {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (normalizedMethod === "GET") {
    return hasPermission(user, "commercial-config:view")
      || hasPermission(user, "water-pricing:view");
  }
  if (!["owner", "admin"].includes(normalizeRole(user?.role))) return false;
  return resourceType === RESOURCE_TYPES.WATER_PRICE
    ? hasPermission(user, "water-pricing:manage")
    : hasPermission(user, "commercial-config:manage");
};

export const readableCommercialBusinessUnits = (user) => {
  const units = new Set();
  if (hasPermission(user, "commercial-config:view")) {
    units.add(COMMERCIAL_BUSINESS_UNITS.REEBS_CORE);
    units.add(COMMERCIAL_BUSINESS_UNITS.SHARED);
  }
  if (hasPermission(user, "water-pricing:view")) {
    units.add(COMMERCIAL_BUSINESS_UNITS.WATER);
  }
  return [
    COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    COMMERCIAL_BUSINESS_UNITS.WATER,
    COMMERCIAL_BUSINESS_UNITS.SHARED,
  ].filter((businessUnit) => units.has(businessUnit));
};

const parseQueryDate = (value, fallback = new Date()) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error("asOf must be a valid date.");
    error.statusCode = 400;
    throw error;
  }
  return parsed;
};

const normalizeView = (value) => {
  const normalized = String(value || "current").trim().toLowerCase();
  if (["current", "schedule", "history"].includes(normalized)) return normalized;
  const error = new Error("view must be current, schedule, or history.");
  error.statusCode = 400;
  throw error;
};

const groupRows = (rows, getKey) => {
  const grouped = new Map();
  for (const row of rows) {
    const key = getKey(row);
    const group = grouped.get(key) || [];
    group.push(row);
    grouped.set(key, group);
  }
  return grouped;
};

export const listCommercialRules = async (
  client,
  organizationId,
  { businessUnits, businessUnit = null, key = null, view, asOf }
) => {
  const unitFilter = businessUnit ? [businessUnit] : businessUnits;
  const params = [organizationId, unitFilter];
  let temporalClause = "";
  if (view !== "history") {
    params.push(asOf.toISOString());
    const asOfParameter = `$${params.length}`;
    temporalClause = view === "schedule"
      ? `AND active = true AND ("effectiveTo" IS NULL OR "effectiveTo" > ${asOfParameter})`
      : `AND active = true
         AND "effectiveFrom" <= ${asOfParameter}
         AND ("effectiveTo" IS NULL OR "effectiveTo" > ${asOfParameter})`;
  }
  let keyClause = "";
  if (key) {
    params.push(key);
    keyClause = `AND "key" = $${params.length}`;
  }
  const result = await client.query(
    `SELECT id, "organizationId", "businessUnit", "key", value, "valueType",
            "effectiveFrom", "effectiveTo", active, description,
            "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     FROM "commercialConfiguration"
     WHERE "organizationId" = $1
       AND "businessUnit" = ANY($2::text[])
       ${temporalClause}
       ${keyClause}
     ORDER BY "businessUnit", "key", "effectiveFrom" DESC, id DESC
     LIMIT ${MAX_LIST_ROWS}`,
    params
  );

  if (view !== "current") {
    return (result.rows || []).map(serializeCommercialConfiguration);
  }
  const grouped = groupRows(
    result.rows || [],
    (row) => `${row.businessUnit}:${row.key}`
  );
  return [...grouped.values()].map((rows) =>
    serializeCommercialConfiguration(
      selectSingleEffectiveRecord(rows, {
        at: asOf,
        missingMessage: "Required commercial configuration is missing.",
      })
    )
  );
};

export const listWaterPrices = async (
  client,
  organizationId,
  { includeWater, productKey = null, priceType = null, view, asOf }
) => {
  if (!includeWater) return [];
  const params = [organizationId];
  const filters = [];
  let temporalClause = "";
  if (view !== "history") {
    params.push(asOf.toISOString());
    const asOfParameter = `$${params.length}`;
    temporalClause = view === "schedule"
      ? `AND active = true AND ("effectiveTo" IS NULL OR "effectiveTo" > ${asOfParameter})`
      : `AND active = true
         AND "effectiveFrom" <= ${asOfParameter}
         AND ("effectiveTo" IS NULL OR "effectiveTo" > ${asOfParameter})`;
  }
  if (productKey) {
    params.push(productKey);
    filters.push(`AND "productKey" = $${params.length}`);
  }
  if (priceType) {
    params.push(priceType);
    filters.push(`AND "priceType" = $${params.length}`);
  }
  const result = await client.query(
    `SELECT id, "organizationId", "productId", "productKey", "productName",
            "priceType", "minimumQuantity", "priceCents", currency,
            "effectiveFrom", "effectiveTo", active, description,
            "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     FROM "waterProductPrice"
     WHERE "organizationId" = $1
       ${temporalClause}
       ${filters.join("\n")}
     ORDER BY "productKey", "priceType", "effectiveFrom" DESC, id DESC
     LIMIT ${MAX_LIST_ROWS}`,
    params
  );

  if (view !== "current") {
    return (result.rows || []).map(serializeWaterProductPrice);
  }
  const grouped = groupRows(
    result.rows || [],
    (row) => `${row.productKey}:${row.priceType}`
  );
  return [...grouped.values()].map((rows) =>
    serializeWaterProductPrice(
      selectSingleEffectiveRecord(rows, {
        at: asOf,
        missingMessage: "Required Water price is missing.",
      })
    )
  );
};

const cloneCommercialRuleTail = async (client, source, effectiveFrom, effectiveTo, actorId) => {
  await client.query(
    `INSERT INTO "commercialConfiguration" (
       "organizationId", "businessUnit", "key", value, "valueType",
       "effectiveFrom", "effectiveTo", active, description,
       "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $9, NOW(), NOW())`,
    [
      source.organizationId,
      source.businessUnit,
      source.key,
      source.value,
      source.valueType,
      effectiveFrom,
      effectiveTo,
      source.description || null,
      actorId,
    ]
  );
};

const applyCommercialRulePlan = async (client, plan, actorId) => {
  for (const action of plan) {
    if (action.operation === "close" || action.operation === "close_and_clone_tail") {
      await client.query(
        `UPDATE "commercialConfiguration"
         SET "effectiveTo" = $2, "updatedByUserId" = $3, "updatedAt" = NOW()
         WHERE id = $1`,
        [action.id, action.effectiveTo, actorId]
      );
    } else {
      await client.query(
        `UPDATE "commercialConfiguration"
         SET active = false, "updatedByUserId" = $2, "updatedAt" = NOW()
         WHERE id = $1`,
        [action.id, actorId]
      );
    }
    if (action.tailEffectiveFrom) {
      await cloneCommercialRuleTail(
        client,
        action.source,
        action.tailEffectiveFrom,
        action.tailEffectiveTo,
        actorId
      );
    }
  }
};

const cloneWaterPriceTail = async (client, source, effectiveFrom, effectiveTo, actorId) => {
  await client.query(
    `INSERT INTO "waterProductPrice" (
       "organizationId", "productId", "productKey", "productName", "priceType",
       "minimumQuantity", "priceCents", currency, "effectiveFrom", "effectiveTo",
       active, description, "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $12, NOW(), NOW())`,
    [
      source.organizationId,
      source.productId || null,
      source.productKey,
      source.productName,
      source.priceType,
      source.minimumQuantity,
      source.priceCents,
      source.currency,
      effectiveFrom,
      effectiveTo,
      source.description || null,
      actorId,
    ]
  );
};

const applyWaterPricePlan = async (client, plan, actorId) => {
  for (const action of plan) {
    if (action.operation === "close" || action.operation === "close_and_clone_tail") {
      await client.query(
        `UPDATE "waterProductPrice"
         SET "effectiveTo" = $2, "updatedByUserId" = $3, "updatedAt" = NOW()
         WHERE id = $1`,
        [action.id, action.effectiveTo, actorId]
      );
    } else {
      await client.query(
        `UPDATE "waterProductPrice"
         SET active = false, "updatedByUserId" = $2, "updatedAt" = NOW()
         WHERE id = $1`,
        [action.id, actorId]
      );
    }
    if (action.tailEffectiveFrom) {
      await cloneWaterPriceTail(
        client,
        action.source,
        action.tailEffectiveFrom,
        action.tailEffectiveTo,
        actorId
      );
    }
  }
};

const createCommercialRule = async (
  client,
  { organizationId, actorId, payload, now }
) => {
  const normalized = normalizeCommercialConfigValue(payload);
  const window = normalizeEffectiveWindow(payload, { now });
  const lockKey = buildCommercialRuleLockKey(
    organizationId,
    normalized.businessUnit,
    normalized.key
  );
  await lockCommercialConfigurationKeys(client, [lockKey]);
  const existingResult = await client.query(
    `SELECT id, "organizationId", "businessUnit", "key", value, "valueType",
            "effectiveFrom", "effectiveTo", active, description,
            "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     FROM "commercialConfiguration"
     WHERE "organizationId" = $1
       AND "businessUnit" = $2
       AND "key" = $3
       AND active = true
     ORDER BY "effectiveFrom", id
     FOR UPDATE`,
    [organizationId, normalized.businessUnit, normalized.key]
  );
  const existingRows = existingResult.rows || [];
  existingRows.forEach(serializeCommercialConfiguration);
  const plan = buildEffectiveDatedOverlapPlan(existingRows, window);
  await applyCommercialRulePlan(client, plan, actorId);
  const inserted = await client.query(
    `INSERT INTO "commercialConfiguration" (
       "organizationId", "businessUnit", "key", value, "valueType",
       "effectiveFrom", "effectiveTo", active, description,
       "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $9, NOW(), NOW())
     RETURNING id, "organizationId", "businessUnit", "key", value, "valueType",
               "effectiveFrom", "effectiveTo", active, description,
               "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"`,
    [
      organizationId,
      normalized.businessUnit,
      normalized.key,
      normalized.storedValue,
      normalized.valueType,
      window.effectiveFrom.toISOString(),
      window.effectiveTo?.toISOString() || null,
      String(payload.description || "").trim().slice(0, 500) || null,
      actorId,
    ]
  );
  return {
    record: serializeCommercialConfiguration(inserted.rows[0]),
    plan,
    previousRecords: existingRows.filter((row) => plan.some((action) => action.id === Number(row.id))),
  };
};

export const validateWaterProductLink = async (client, organizationId, productId) => {
  if (productId === null || productId === undefined) return null;
  const result = await client.query(
    `SELECT id, name, "sourceCategoryCode"
     FROM "product"
     WHERE id = $1 AND "organizationId" = $2
     LIMIT 1`,
    [productId, organizationId]
  );
  if (result.rowCount === 0) {
    const error = new Error("Linked Water inventory product was not found in this organization.");
    error.statusCode = 400;
    throw error;
  }
  const product = result.rows[0];
  if (String(product?.sourceCategoryCode || "").trim().toUpperCase() !== "WATER") {
    const error = new Error(
      "Linked Water inventory product must have sourceCategoryCode WATER."
    );
    error.statusCode = 400;
    error.code = "WATER_PRODUCT_CLASSIFICATION_REQUIRED";
    throw error;
  }
  return product;
};

const createWaterPrice = async (
  client,
  { organizationId, actorId, payload, now }
) => {
  const candidateProductId = payload.productId === null || payload.productId === undefined
    ? null
    : Number(payload.productId);
  const linkedProduct = await validateWaterProductLink(
    client,
    organizationId,
    Number.isInteger(candidateProductId) && candidateProductId > 0 ? candidateProductId : null
  );
  const normalized = normalizeWaterProductPriceInput({
    ...payload,
    productId: candidateProductId,
    productName: linkedProduct?.name || payload.productName,
  });
  const window = normalizeEffectiveWindow(payload, { now });
  const lockKey = buildWaterPriceLockKey(
    organizationId,
    normalized.productKey,
    normalized.priceType
  );
  await lockCommercialConfigurationKeys(client, [lockKey]);
  const existingResult = await client.query(
    `SELECT id, "organizationId", "productId", "productKey", "productName",
            "priceType", "minimumQuantity", "priceCents", currency,
            "effectiveFrom", "effectiveTo", active, description,
            "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     FROM "waterProductPrice"
     WHERE "organizationId" = $1
       AND "productKey" = $2
       AND "priceType" = $3
       AND active = true
     ORDER BY "effectiveFrom", id
     FOR UPDATE`,
    [organizationId, normalized.productKey, normalized.priceType]
  );
  const existingRows = existingResult.rows || [];
  existingRows.forEach(serializeWaterProductPrice);
  const plan = buildEffectiveDatedOverlapPlan(existingRows, window);
  await applyWaterPricePlan(client, plan, actorId);
  const inserted = await client.query(
    `INSERT INTO "waterProductPrice" (
       "organizationId", "productId", "productKey", "productName", "priceType",
       "minimumQuantity", "priceCents", currency, "effectiveFrom", "effectiveTo",
       active, description, "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $12, NOW(), NOW())
     RETURNING id, "organizationId", "productId", "productKey", "productName",
               "priceType", "minimumQuantity", "priceCents", currency,
               "effectiveFrom", "effectiveTo", active, description,
               "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"`,
    [
      organizationId,
      normalized.productId,
      normalized.productKey,
      normalized.productName,
      normalized.priceType,
      normalized.minimumQuantity,
      normalized.priceCents,
      normalized.currency,
      window.effectiveFrom.toISOString(),
      window.effectiveTo?.toISOString() || null,
      normalized.description,
      actorId,
    ]
  );
  return {
    record: serializeWaterProductPrice(inserted.rows[0]),
    plan,
    previousRecords: existingRows.filter((row) => plan.some((action) => action.id === Number(row.id))),
  };
};

const auditCreatedRecord = async (
  client,
  event,
  { organizationId, authUser, resourceType, result }
) => {
  const isWaterPrice = resourceType === RESOURCE_TYPES.WATER_PRICE;
  const record = result.record;
  await writeAuditLog(client, {
    organizationId,
    userId: Number(authUser.id),
    action: isWaterPrice
      ? "WATER_PRODUCT_PRICE_CREATED"
      : "COMMERCIAL_CONFIGURATION_CREATED",
    targetType: isWaterPrice ? "waterProductPrice" : "commercialConfiguration",
    targetId: String(record.id),
    category: "finance",
    severity: "info",
    status: "ok",
    summary: isWaterPrice
      ? `Scheduled ${record.priceType} pricing for ${record.productName}.`
      : `Scheduled ${record.businessUnit} commercial rule ${record.key}.`,
    actorLabel: authUser.fullName || authUser.email,
    requestId: getEventHeader(event, "x-request-id"),
    ipAddress: getEventIpAddress(event),
    metadata: {
      businessUnit: isWaterPrice ? COMMERCIAL_BUSINESS_UNITS.WATER : record.businessUnit,
      setting: isWaterPrice ? `${record.productKey}:${record.priceType}` : record.key,
      oldValues: result.previousRecords.map((previous) => ({
        id: Number(previous.id),
        value: isWaterPrice ? Number(previous.priceCents) : previous.value,
        effectiveFrom: previous.effectiveFrom,
        effectiveTo: previous.effectiveTo || null,
      })),
      newValue: isWaterPrice ? record.priceCents : record.value,
      valueType: isWaterPrice ? "MONEY_CENTS" : record.valueType,
      effectiveFrom: record.effectiveFrom,
      effectiveTo: record.effectiveTo,
      overlapActions: result.plan.map(({ id, operation }) => ({ id, operation })),
    },
  });
};

const handleGet = async (client, event, { organizationId, authUser }) => {
  const query = event.queryStringParameters || {};
  const view = normalizeView(query.view);
  const asOf = parseQueryDate(query.asOf);
  const readableUnits = readableCommercialBusinessUnits(authUser);
  const requestedUnit = query.businessUnit
    ? normalizeCommercialBusinessUnit(query.businessUnit)
    : null;
  if (requestedUnit && !readableUnits.includes(requestedUnit)) {
    return json(event, 403, { error: "You cannot view configuration for that business unit." });
  }

  const requestedKey = String(query.key || "").trim().toLowerCase() || null;
  if (requestedKey && !requestedUnit) {
    return json(event, 400, { error: "businessUnit is required when filtering by key." });
  }
  if (requestedKey) {
    getCommercialConfigDefinition(requestedUnit, requestedKey);
  }

  const requestedProductKey = query.productKey ? normalizeProductKey(query.productKey) : null;
  const requestedPriceType = query.priceType ? normalizeWaterPriceType(query.priceType) : null;
  const includeWater = readableUnits.includes(COMMERCIAL_BUSINESS_UNITS.WATER)
    && (!requestedUnit || requestedUnit === COMMERCIAL_BUSINESS_UNITS.WATER);
  const [rules, waterPrices] = await Promise.all([
    listCommercialRules(client, organizationId, {
      businessUnits: readableUnits,
      businessUnit: requestedUnit,
      key: requestedKey,
      view,
      asOf,
    }),
    listWaterPrices(client, organizationId, {
      includeWater,
      productKey: requestedProductKey,
      priceType: requestedPriceType,
      view,
      asOf,
    }),
  ]);
  const definitions = Object.values(COMMERCIAL_CONFIG_DEFINITIONS)
    .filter((definition) => readableUnits.includes(definition.businessUnit));
  return json(event, 200, {
    asOf: asOf.toISOString(),
    view,
    businessUnits: readableUnits,
    definitions,
    rules,
    waterPrices,
  });
};

const handlePost = async (client, event, { organizationId, authUser, payload }) => {
  const resourceType = normalizeResourceType(payload.resourceType || payload.type);
  const now = new Date();
  await client.query("BEGIN");
  try {
    const result = resourceType === RESOURCE_TYPES.COMMERCIAL_RULE
      ? await createCommercialRule(client, {
        organizationId,
        actorId: Number(authUser.id),
        payload,
        now,
      })
      : await createWaterPrice(client, {
        organizationId,
        actorId: Number(authUser.id),
        payload,
        now,
      });
    await auditCreatedRecord(client, event, {
      organizationId,
      authUser,
      resourceType,
      result,
    });
    await client.query("COMMIT");
    return json(event, 201, { resourceType, record: result.record });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};

export async function handler(event = {}) {
  const method = String(event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") return json(event, 204, {});
  if (!["GET", "POST"].includes(method)) {
    return json(event, 405, { error: "Method Not Allowed" });
  }

  const payload = method === "POST" ? parseBody(event) : null;
  if (method === "POST" && !payload) {
    return json(event, 400, { error: "Invalid JSON body." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });
  try {
    await client.connect();
    const authResult = await requireInternalUser(client, event, {
      methods: METHODS,
      roles: method === "POST" ? ["owner", "admin"] : [],
      roleError: "Only owners and admins can change commercial configuration.",
      body: payload,
    });
    if (authResult.errorResponse) return authResult.errorResponse;
    const requestedResourceType = method === "POST"
      ? normalizeResourceType(payload.resourceType || payload.type)
      : null;
    if (!canAccessCommercialConfigMethod(authResult.authUser, method, requestedResourceType)) {
      return json(event, 403, { error: "You cannot access commercial configuration." });
    }

    if (method === "GET") {
      return await handleGet(client, event, authResult);
    }
    return await handlePost(client, event, { ...authResult, payload });
  } catch (error) {
    const statusCode = error?.statusCode
      || (error?.code === "23505" ? 409 : null)
      || (error?.code === "42P01" ? 503 : null)
      || 500;
    if (statusCode >= 500) {
      console.error("Commercial configuration request failed:", error?.message || error);
    }
    return json(event, statusCode, {
      error: statusCode >= 500
        ? "Commercial configuration is unavailable."
        : error?.message || "Commercial configuration request failed.",
      ...(error instanceof CommercialConfigurationError ? { code: error.code } : {}),
    });
  } finally {
    await client.end().catch(() => {});
  }
}
