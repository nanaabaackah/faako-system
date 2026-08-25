/* eslint-disable no-undef */

export const COMMERCIAL_BUSINESS_UNITS = Object.freeze({
  REEBS_CORE: "REEBS_CORE",
  WATER: "WATER",
  SHARED: "SHARED",
});

export const COMMERCIAL_VALUE_TYPES = Object.freeze({
  INTEGER: "INTEGER",
  MONEY_CENTS: "MONEY_CENTS",
  BASIS_POINTS: "BASIS_POINTS",
  BOOLEAN: "BOOLEAN",
  STRING: "STRING",
});

export const COMMERCIAL_CONFIG_KEYS = Object.freeze({
  BOOKING_BUNDLE_MIN_ITEMS: "booking_bundle_min_items",
  BOOKING_BUNDLE_DISCOUNT_BPS: "booking_bundle_discount_bps",
  BOOKING_ATTENDANT_UNIT_FEE_CENTS: "booking_attendant_unit_fee_cents",
  DELIVERY_PER_KM_FEE_CENTS: "delivery_per_km_fee_cents",
  SERVICE_DEPOSIT_BPS: "service_deposit_bps",
  SERVICE_DEPOSIT_DUE_DAYS: "service_deposit_due_days",
  WATER_DISCOUNT_LIMIT_BPS: "water_discount_limit_bps",
});

export const WATER_PRICE_TYPES = Object.freeze({
  RETAIL: "RETAIL",
  BULK_RETAIL: "BULK_RETAIL",
  COMPANY: "COMPANY",
});

export const buildCommercialRuleLockKey = (organizationId, businessUnit, key) =>
  [organizationId, "commercial-rule", businessUnit, key].join(":");

export const buildWaterPriceLockKey = (organizationId, productKey, priceType) =>
  [organizationId, "water-price", productKey, priceType].join(":");

export const lockCommercialConfigurationKeys = async (client, lockKeys = []) => {
  const keys = [...new Set(lockKeys.map((key) => String(key || "").trim()).filter(Boolean))].sort();
  for (const lockKey of keys) {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [lockKey]
    );
  }
};

const definitionList = [
  {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    key: COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_MIN_ITEMS,
    valueType: COMMERCIAL_VALUE_TYPES.INTEGER,
    unit: "items",
    min: 1,
    max: 100,
  },
  {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    key: COMMERCIAL_CONFIG_KEYS.BOOKING_BUNDLE_DISCOUNT_BPS,
    valueType: COMMERCIAL_VALUE_TYPES.BASIS_POINTS,
    unit: "basis_points",
    min: 0,
    max: 10000,
  },
  {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    key: COMMERCIAL_CONFIG_KEYS.BOOKING_ATTENDANT_UNIT_FEE_CENTS,
    valueType: COMMERCIAL_VALUE_TYPES.MONEY_CENTS,
    unit: "pesewas",
    min: 0,
    max: 100000000,
  },
  {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    key: COMMERCIAL_CONFIG_KEYS.DELIVERY_PER_KM_FEE_CENTS,
    valueType: COMMERCIAL_VALUE_TYPES.MONEY_CENTS,
    unit: "pesewas_per_kilometre",
    min: 0,
    max: 10000000,
  },
  {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    key: COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_BPS,
    valueType: COMMERCIAL_VALUE_TYPES.BASIS_POINTS,
    unit: "basis_points",
    min: 0,
    max: 10000,
  },
  {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.REEBS_CORE,
    key: COMMERCIAL_CONFIG_KEYS.SERVICE_DEPOSIT_DUE_DAYS,
    valueType: COMMERCIAL_VALUE_TYPES.INTEGER,
    unit: "days",
    min: 0,
    max: 365,
  },
  {
    businessUnit: COMMERCIAL_BUSINESS_UNITS.WATER,
    key: COMMERCIAL_CONFIG_KEYS.WATER_DISCOUNT_LIMIT_BPS,
    valueType: COMMERCIAL_VALUE_TYPES.BASIS_POINTS,
    unit: "basis_points",
    min: 0,
    // 9,999 preserves the existing rule that a Water discount must be below 100%.
    max: 9999,
  },
];

const definitionId = (businessUnit, key) => `${businessUnit}:${key}`;

export const COMMERCIAL_CONFIG_DEFINITIONS = Object.freeze(
  Object.fromEntries(
    definitionList.map((definition) => [
      definitionId(definition.businessUnit, definition.key),
      Object.freeze({ ...definition }),
    ])
  )
);

const BUSINESS_UNIT_VALUES = new Set(Object.values(COMMERCIAL_BUSINESS_UNITS));
const WATER_PRICE_TYPE_VALUES = new Set(Object.values(WATER_PRICE_TYPES));
const VALUE_TYPE_VALUES = new Set(Object.values(COMMERCIAL_VALUE_TYPES));
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PRODUCT_NAME_LENGTH = 160;
const MAX_PRODUCT_KEY_LENGTH = 120;
const MAX_WATER_PRICE_CENTS = 100000000;

export class CommercialConfigurationError extends Error {
  constructor(message, { code = "COMMERCIAL_CONFIGURATION_ERROR", statusCode = 400 } = {}) {
    super(message);
    this.name = "CommercialConfigurationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

const configurationError = (message, code, statusCode = 400) =>
  new CommercialConfigurationError(message, { code, statusCode });

const normalizeString = (value) => String(value ?? "").trim();

const normalizeDescription = (value) => {
  const description = normalizeString(value).replace(/\s+/g, " ");
  return description ? description.slice(0, MAX_DESCRIPTION_LENGTH) : null;
};

const parsePositiveOrganizationId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw configurationError(
      "A valid organization is required for commercial configuration.",
      "INVALID_COMMERCIAL_ORGANIZATION"
    );
  }
  return parsed;
};

export const normalizeCommercialBusinessUnit = (value) => {
  const normalized = normalizeString(value).toUpperCase();
  if (!BUSINESS_UNIT_VALUES.has(normalized)) {
    throw configurationError(
      "Business unit must be REEBS_CORE, WATER, or SHARED.",
      "INVALID_COMMERCIAL_BUSINESS_UNIT"
    );
  }
  return normalized;
};

export const normalizeWaterPriceType = (value) => {
  const normalized = normalizeString(value).toUpperCase();
  if (!WATER_PRICE_TYPE_VALUES.has(normalized)) {
    throw configurationError(
      "Water price type must be RETAIL, BULK_RETAIL, or COMPANY.",
      "INVALID_WATER_PRICE_TYPE"
    );
  }
  return normalized;
};

export const normalizeProductKey = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (
    !normalized
    || normalized.length > MAX_PRODUCT_KEY_LENGTH
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)
  ) {
    throw configurationError(
      "Water productKey must be a lowercase hyphenated identifier.",
      "INVALID_WATER_PRODUCT_KEY"
    );
  }
  return normalized;
};

const parseExactInteger = (value) => {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : null;
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
};

const parseTypedValue = (value, definition) => {
  if (definition.valueType === COMMERCIAL_VALUE_TYPES.BOOLEAN) {
    const parsed = parseBoolean(value);
    return parsed === null ? null : parsed;
  }

  if (definition.valueType === COMMERCIAL_VALUE_TYPES.STRING) {
    const parsed = normalizeString(value);
    return parsed ? parsed.slice(0, 500) : null;
  }

  return parseExactInteger(value);
};

const toStoredValue = (value, valueType) => {
  if (valueType === COMMERCIAL_VALUE_TYPES.BOOLEAN) return value ? "true" : "false";
  return String(value);
};

export const getCommercialConfigDefinition = (businessUnit, key) => {
  const normalizedBusinessUnit = normalizeCommercialBusinessUnit(businessUnit);
  const normalizedKey = normalizeString(key).toLowerCase();
  const definition = COMMERCIAL_CONFIG_DEFINITIONS[
    definitionId(normalizedBusinessUnit, normalizedKey)
  ];
  if (!definition) {
    throw configurationError(
      `Unsupported commercial configuration key for ${normalizedBusinessUnit}.`,
      "UNKNOWN_COMMERCIAL_CONFIGURATION"
    );
  }
  return definition;
};

export const normalizeCommercialConfigValue = (
  { businessUnit, key, value, valueType } = {},
  { persisted = false } = {}
) => {
  const fail = (message) => {
    throw configurationError(
      message,
      persisted ? "CORRUPT_COMMERCIAL_CONFIGURATION" : "INVALID_COMMERCIAL_CONFIGURATION",
      persisted ? 503 : 400
    );
  };

  let definition;
  try {
    definition = getCommercialConfigDefinition(businessUnit, key);
  } catch (error) {
    if (!persisted) throw error;
    fail("Stored commercial configuration uses an unsupported business unit or key.");
  }

  const suppliedType = normalizeString(valueType).toUpperCase();
  if (suppliedType && !VALUE_TYPE_VALUES.has(suppliedType)) {
    fail("Commercial configuration has an unsupported value type.");
  }
  if (suppliedType && suppliedType !== definition.valueType) {
    fail(`Commercial configuration ${definition.key} must use ${definition.valueType}.`);
  }

  const parsedValue = parseTypedValue(value, definition);
  if (parsedValue === null) {
    fail(`Commercial configuration ${definition.key} has an invalid value.`);
  }
  if (typeof parsedValue === "number") {
    if (Number.isFinite(definition.min) && parsedValue < definition.min) {
      fail(`Commercial configuration ${definition.key} must be at least ${definition.min}.`);
    }
    if (Number.isFinite(definition.max) && parsedValue > definition.max) {
      fail(`Commercial configuration ${definition.key} must be no more than ${definition.max}.`);
    }
  }

  return {
    ...definition,
    value: parsedValue,
    storedValue: toStoredValue(parsedValue, definition.valueType),
  };
};

const parseDate = (value, field, { required = true } = {}) => {
  if ((value === undefined || value === null || value === "") && !required) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw configurationError(`${field} must be a valid date.`, "INVALID_EFFECTIVE_DATE");
  }
  return parsed;
};

export const normalizeEffectiveWindow = (
  { effectiveFrom, effectiveTo } = {},
  { now = new Date(), allowPast = false } = {}
) => {
  const referenceNow = parseDate(now, "now");
  const from = effectiveFrom ? parseDate(effectiveFrom, "effectiveFrom") : referenceNow;
  const to = parseDate(effectiveTo, "effectiveTo", { required: false });

  if (!allowPast && from.getTime() < referenceNow.getTime() - 1000) {
    throw configurationError(
      "effectiveFrom must be current or future; historical records are immutable.",
      "PAST_EFFECTIVE_DATE"
    );
  }
  if (to && to.getTime() <= from.getTime()) {
    throw configurationError(
      "effectiveTo must be later than effectiveFrom.",
      "INVALID_EFFECTIVE_WINDOW"
    );
  }

  return { effectiveFrom: from, effectiveTo: to };
};

const parseStoredEffectiveWindow = (row) => {
  try {
    if (!row?.effectiveFrom) throw new TypeError("effectiveFrom is required");
    return normalizeEffectiveWindow(row, { allowPast: true });
  } catch {
    throw configurationError(
      "Stored commercial configuration has an invalid effective period.",
      "CORRUPT_COMMERCIAL_CONFIGURATION",
      503
    );
  }
};

const toIsoOrNull = (value) => (value ? new Date(value).toISOString() : null);

export const serializeCommercialConfiguration = (row = {}) => {
  const normalized = normalizeCommercialConfigValue(row, { persisted: true });
  const window = parseStoredEffectiveWindow(row);
  return {
    id: Number(row.id),
    organizationId: Number(row.organizationId),
    businessUnit: normalized.businessUnit,
    key: normalized.key,
    value: normalized.value,
    valueType: normalized.valueType,
    unit: normalized.unit,
    effectiveFrom: window.effectiveFrom.toISOString(),
    effectiveTo: toIsoOrNull(window.effectiveTo),
    active: row.active !== false,
    description: normalizeDescription(row.description),
    createdByUserId: row.createdByUserId ? Number(row.createdByUserId) : null,
    updatedByUserId: row.updatedByUserId ? Number(row.updatedByUserId) : null,
    createdAt: toIsoOrNull(row.createdAt),
    updatedAt: toIsoOrNull(row.updatedAt),
  };
};

export const normalizeWaterProductPriceInput = (
  input = {},
  { persisted = false } = {}
) => {
  const fail = (message) => {
    throw configurationError(
      message,
      persisted ? "CORRUPT_WATER_PRICE" : "INVALID_WATER_PRICE",
      persisted ? 503 : 400
    );
  };

  let productKey;
  let priceType;
  try {
    productKey = normalizeProductKey(input.productKey);
    priceType = normalizeWaterPriceType(input.priceType);
  } catch (error) {
    if (!persisted) throw error;
    fail("Stored Water price has an invalid product key or price type.");
  }

  const productName = normalizeString(input.productName).replace(/\s+/g, " ");
  if (!productName || productName.length > MAX_PRODUCT_NAME_LENGTH) {
    fail("Water productName is required and must not exceed 160 characters.");
  }

  const hasProductId = input.productId !== null && input.productId !== undefined;
  const productId = hasProductId ? parseExactInteger(input.productId) : null;
  if (hasProductId && (productId === null || productId <= 0)) {
    fail("Water productId must be a positive integer when supplied.");
  }

  const minimumQuantity = parseExactInteger(input.minimumQuantity ?? 1);
  if (minimumQuantity === null || minimumQuantity <= 0 || minimumQuantity > 100000) {
    fail("Water minimumQuantity must be an integer between 1 and 100000.");
  }

  const priceCents = parseExactInteger(input.priceCents);
  if (priceCents === null || priceCents <= 0 || priceCents > MAX_WATER_PRICE_CENTS) {
    fail("Water priceCents must be a positive integer in pesewas.");
  }

  const currency = normalizeString(input.currency || "GHS").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    fail("Water price currency must be a three-letter ISO currency code.");
  }

  return {
    productId,
    productKey,
    productName,
    priceType,
    minimumQuantity,
    priceCents,
    currency,
    description: normalizeDescription(input.description),
  };
};

export const serializeWaterProductPrice = (row = {}) => {
  const normalized = normalizeWaterProductPriceInput(row, { persisted: true });
  const window = parseStoredEffectiveWindow(row);
  return {
    id: Number(row.id),
    organizationId: Number(row.organizationId),
    ...normalized,
    effectiveFrom: window.effectiveFrom.toISOString(),
    effectiveTo: toIsoOrNull(window.effectiveTo),
    active: row.active !== false,
    createdByUserId: row.createdByUserId ? Number(row.createdByUserId) : null,
    updatedByUserId: row.updatedByUserId ? Number(row.updatedByUserId) : null,
    createdAt: toIsoOrNull(row.createdAt),
    updatedAt: toIsoOrNull(row.updatedAt),
  };
};

export const isEffectiveAt = (row = {}, at = new Date()) => {
  if (row.active === false) return false;
  const instant = parseDate(at, "asOf").getTime();
  const { effectiveFrom, effectiveTo } = parseStoredEffectiveWindow(row);
  return effectiveFrom.getTime() <= instant
    && (!effectiveTo || effectiveTo.getTime() > instant);
};

const integrityError = (message, code) =>
  configurationError(message, code, 503);

export const selectSingleEffectiveRecord = (
  rows = [],
  { at = new Date(), missingMessage = "Required commercial configuration is missing." } = {}
) => {
  const effectiveRows = rows.filter((row) => isEffectiveAt(row, at));
  if (effectiveRows.length === 0) {
    throw integrityError(missingMessage, "MISSING_COMMERCIAL_CONFIGURATION");
  }
  if (effectiveRows.length > 1) {
    throw integrityError(
      "Overlapping commercial configuration records require administrator reconciliation.",
      "AMBIGUOUS_COMMERCIAL_CONFIGURATION"
    );
  }
  return effectiveRows[0];
};

export const buildEffectiveDatedOverlapPlan = (
  rows = [],
  { effectiveFrom, effectiveTo } = {}
) => {
  const nextWindow = normalizeEffectiveWindow(
    { effectiveFrom, effectiveTo },
    { allowPast: true }
  );
  const nextStart = nextWindow.effectiveFrom.getTime();
  const nextEnd = nextWindow.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const actions = [];

  for (const row of rows) {
    if (row.active === false) continue;
    const existingWindow = parseStoredEffectiveWindow(row);
    const existingStart = existingWindow.effectiveFrom.getTime();
    const existingEnd = existingWindow.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
    const overlaps = existingStart < nextEnd && nextStart < existingEnd;
    if (!overlaps) continue;

    const hasTail = Number.isFinite(nextEnd) && existingEnd > nextEnd;
    if (existingStart < nextStart) {
      actions.push({
        id: Number(row.id),
        operation: hasTail ? "close_and_clone_tail" : "close",
        effectiveTo: nextWindow.effectiveFrom.toISOString(),
        tailEffectiveFrom: hasTail ? nextWindow.effectiveTo.toISOString() : null,
        tailEffectiveTo: hasTail ? toIsoOrNull(existingWindow.effectiveTo) : null,
        source: row,
      });
    } else {
      actions.push({
        id: Number(row.id),
        operation: hasTail ? "deactivate_and_clone_tail" : "deactivate",
        effectiveTo: null,
        tailEffectiveFrom: hasTail ? nextWindow.effectiveTo.toISOString() : null,
        tailEffectiveTo: hasTail ? toIsoOrNull(existingWindow.effectiveTo) : null,
        source: row,
      });
    }
  }

  return actions;
};

const requireClient = (client) => {
  if (!client || typeof client.query !== "function") {
    throw new TypeError("A database client is required.");
  }
  return client;
};

const parseAsOf = (value) => parseDate(value || new Date(), "asOf");

export const resolveCommercialConfiguration = async (
  client,
  { organizationId, businessUnit, key, at = new Date() } = {}
) => {
  requireClient(client);
  const scopedOrganizationId = parsePositiveOrganizationId(organizationId);
  const definition = getCommercialConfigDefinition(businessUnit, key);
  const asOf = parseAsOf(at);
  const result = await client.query(
    `SELECT id, "organizationId", "businessUnit", "key", value, "valueType",
            "effectiveFrom", "effectiveTo", active, description,
            "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     FROM "commercialConfiguration"
     WHERE "organizationId" = $1
       AND "businessUnit" = $2
       AND "key" = $3
       AND active = true
       AND "effectiveFrom" <= $4
       AND ("effectiveTo" IS NULL OR "effectiveTo" > $4)
     ORDER BY "effectiveFrom" DESC, id DESC
     LIMIT 2`,
    [scopedOrganizationId, definition.businessUnit, definition.key, asOf.toISOString()]
  );
  const selected = selectSingleEffectiveRecord(result.rows || [], {
    at: asOf,
    missingMessage: `Required commercial configuration ${definition.key} is missing.`,
  });
  return serializeCommercialConfiguration(selected);
};

export const resolveCommercialValue = async (client, options = {}) =>
  (await resolveCommercialConfiguration(client, options)).value;

export const resolveWaterProductPrice = async (
  client,
  { organizationId, productKey, priceType, at = new Date() } = {}
) => {
  requireClient(client);
  const scopedOrganizationId = parsePositiveOrganizationId(organizationId);
  const normalizedProductKey = normalizeProductKey(productKey);
  const normalizedPriceType = normalizeWaterPriceType(priceType);
  const asOf = parseAsOf(at);
  const result = await client.query(
    `SELECT id, "organizationId", "productId", "productKey", "productName",
            "priceType", "minimumQuantity", "priceCents", currency,
            "effectiveFrom", "effectiveTo", active, description,
            "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     FROM "waterProductPrice"
     WHERE "organizationId" = $1
       AND "productKey" = $2
       AND "priceType" = $3
       AND active = true
       AND "effectiveFrom" <= $4
       AND ("effectiveTo" IS NULL OR "effectiveTo" > $4)
     ORDER BY "effectiveFrom" DESC, id DESC
     LIMIT 2`,
    [scopedOrganizationId, normalizedProductKey, normalizedPriceType, asOf.toISOString()]
  );
  const selected = selectSingleEffectiveRecord(result.rows || [], {
    at: asOf,
    missingMessage: `Required Water ${normalizedPriceType} price for ${normalizedProductKey} is missing.`,
  });
  return serializeWaterProductPrice(selected);
};

export const resolveWaterSalePrice = async (
  client,
  {
    organizationId,
    productKey,
    saleChannel = "retail",
    quantity = 1,
    at = new Date(),
  } = {}
) => {
  requireClient(client);
  const scopedOrganizationId = parsePositiveOrganizationId(organizationId);
  const normalizedProductKey = normalizeProductKey(productKey);
  const normalizedQuantity = parseExactInteger(quantity);
  if (normalizedQuantity === null || normalizedQuantity <= 0) {
    throw configurationError("Water sale quantity must be a positive integer.", "INVALID_WATER_QUANTITY");
  }
  const normalizedChannel = normalizeString(saleChannel).toLowerCase();
  if (normalizedChannel === "company") {
    return resolveWaterProductPrice(client, {
      organizationId: scopedOrganizationId,
      productKey: normalizedProductKey,
      priceType: WATER_PRICE_TYPES.COMPANY,
      at,
    });
  }
  if (normalizedChannel !== "retail") {
    throw configurationError("Water saleChannel must be retail or company.", "INVALID_WATER_CHANNEL");
  }

  const asOf = parseAsOf(at);
  const result = await client.query(
    `SELECT id, "organizationId", "productId", "productKey", "productName",
            "priceType", "minimumQuantity", "priceCents", currency,
            "effectiveFrom", "effectiveTo", active, description,
            "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"
     FROM "waterProductPrice"
     WHERE "organizationId" = $1
       AND "productKey" = $2
       AND "priceType" IN ('RETAIL', 'BULK_RETAIL')
       AND "minimumQuantity" <= $3
       AND active = true
       AND "effectiveFrom" <= $4
       AND ("effectiveTo" IS NULL OR "effectiveTo" > $4)
     ORDER BY "minimumQuantity" DESC, "effectiveFrom" DESC, id DESC`,
    [scopedOrganizationId, normalizedProductKey, normalizedQuantity, asOf.toISOString()]
  );

  const effectiveByType = new Map();
  for (const row of result.rows || []) {
    if (!isEffectiveAt(row, asOf)) continue;
    const rowsForType = effectiveByType.get(row.priceType) || [];
    rowsForType.push(row);
    effectiveByType.set(row.priceType, rowsForType);
  }
  for (const rowsForType of effectiveByType.values()) {
    if (rowsForType.length > 1) {
      throw integrityError(
        "Overlapping Water price records require administrator reconciliation.",
        "AMBIGUOUS_WATER_PRICE"
      );
    }
  }

  const candidates = [...effectiveByType.values()]
    .flat()
    .sort((left, right) => Number(right.minimumQuantity) - Number(left.minimumQuantity));
  if (candidates.length === 0) {
    throw integrityError(
      `Required retail Water price for ${normalizedProductKey} is missing.`,
      "MISSING_WATER_PRICE"
    );
  }
  return serializeWaterProductPrice(candidates[0]);
};
