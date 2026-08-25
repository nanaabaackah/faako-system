export const COMMERCIAL_CONFIG_ENDPOINT = "/api/commercial-config";

export const CORE_BUSINESS_UNIT = "REEBS_CORE";

export const CORE_COMMERCIAL_RULES = Object.freeze([
  {
    key: "booking_bundle_min_items",
    label: "Bundle eligibility",
    inputLabel: "Minimum items",
    description: "Minimum number of rental items required before bundle pricing can apply.",
    displayUnit: "items",
  },
  {
    key: "booking_bundle_discount_bps",
    label: "Bundle discount",
    inputLabel: "Discount",
    description: "Discount applied to qualifying REEBS Core rental bundles.",
    displayUnit: "%",
  },
  {
    key: "booking_attendant_unit_fee_cents",
    label: "Booking attendant fee",
    inputLabel: "Fee per attendant",
    description: "REEBS Core fee charged for each attendant added to a booking.",
    displayUnit: "GHS per attendant",
  },
  {
    key: "delivery_per_km_fee_cents",
    label: "Delivery distance fee",
    inputLabel: "Fee per kilometre",
    description: "REEBS Core delivery charge used for each kilometre.",
    displayUnit: "GHS per km",
  },
  {
    key: "service_deposit_bps",
    label: "Service deposit",
    inputLabel: "Deposit rate",
    description: "Deposit percentage required for applicable REEBS Core services.",
    displayUnit: "%",
  },
  {
    key: "service_deposit_due_days",
    label: "Deposit due period",
    inputLabel: "Due after",
    description: "Number of days allowed before an applicable service deposit is due.",
    displayUnit: "days",
  },
]);

export const WATER_PRICE_TYPES = Object.freeze([
  { value: "RETAIL", label: "Retail" },
  { value: "BULK_RETAIL", label: "Bulk retail" },
  { value: "COMPANY", label: "Company" },
]);

const WATER_PRICE_TYPE_VALUES = new Set(WATER_PRICE_TYPES.map(({ value }) => value));

export const getCommercialScheduleAccess = (role) => {
  const normalizedRole = String(role || "staff").trim().toLowerCase();
  const canManage = normalizedRole === "owner" || normalizedRole === "admin";
  return {
    canManage,
    canViewCore: canManage || normalizedRole === "manager",
    canViewWater: canManage || normalizedRole === "water",
  };
};

const asDate = (value, fallback = new Date()) => {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
};

export const toDateInputValue = (value = new Date()) =>
  asDate(value).toISOString().slice(0, 10);

export const toEffectiveFrom = (dateValue, now = new Date()) => {
  const normalized = String(dateValue || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Choose a valid effective date.");
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new Error("Choose a valid effective date.");
  }

  const reference = asDate(now);
  const today = toDateInputValue(reference);
  if (normalized < today) {
    throw new Error("Effective date must be today or later.");
  }

  // Let the server choose its own current timestamp for same-day changes so
  // network latency cannot make a client-generated timestamp historical.
  return normalized === today ? undefined : parsed.toISOString();
};

const decimalPlaces = (value) => {
  const normalized = String(value).trim();
  const decimal = normalized.split(".")[1];
  return decimal ? decimal.length : 0;
};

const parseDecimal = (value, label, { positive = false } = {}) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`Enter ${label.toLowerCase()}.`);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || (positive ? parsed <= 0 : parsed < 0)) {
    throw new Error(`${label} must be ${positive ? "greater than zero" : "zero or more"}.`);
  }
  if (decimalPlaces(normalized) > 2) {
    throw new Error(`${label} can use no more than two decimal places.`);
  }
  return parsed;
};

const scaleDefinitionValue = (value, definition) => {
  if (["BASIS_POINTS", "MONEY_CENTS"].includes(definition?.valueType)) {
    return Math.round(value * 100);
  }
  return value;
};

const unscaleDefinitionValue = (value, definition) => {
  if (["BASIS_POINTS", "MONEY_CENTS"].includes(definition?.valueType)) {
    return Number(value) / 100;
  }
  return Number(value);
};

export const getRuleInputBounds = (definition = {}) => ({
  min: Number.isFinite(Number(definition.min))
    ? unscaleDefinitionValue(definition.min, definition)
    : undefined,
  max: Number.isFinite(Number(definition.max))
    ? unscaleDefinitionValue(definition.max, definition)
    : undefined,
  step: definition.valueType === "INTEGER" ? 1 : 0.01,
});

export const parseCommercialRuleValue = (input, definition, label = "Value") => {
  const parsed = parseDecimal(input, label);
  if (definition?.valueType === "INTEGER" && !Number.isInteger(parsed)) {
    throw new Error(`${label} must be a whole number.`);
  }
  const storedValue = scaleDefinitionValue(parsed, definition);
  if (Number.isFinite(Number(definition?.min)) && storedValue < Number(definition.min)) {
    throw new Error(`${label} must be at least ${getRuleInputBounds(definition).min}.`);
  }
  if (Number.isFinite(Number(definition?.max)) && storedValue > Number(definition.max)) {
    throw new Error(`${label} must be no more than ${getRuleInputBounds(definition).max}.`);
  }
  return storedValue;
};

export const buildCommercialRulePayload = (
  draft,
  definition,
  metadata,
  now = new Date(),
) => {
  const payload = {
    resourceType: "commercial_rule",
    businessUnit: definition.businessUnit,
    key: definition.key,
    value: parseCommercialRuleValue(draft?.value, definition, metadata?.inputLabel || "Value"),
    valueType: definition.valueType,
    description: metadata?.description,
  };
  const effectiveFrom = toEffectiveFrom(draft?.effectiveDate, now);
  if (effectiveFrom) payload.effectiveFrom = effectiveFrom;
  return payload;
};

const isEffectiveAt = (record, instant) => {
  if (!record || record.active === false) return false;
  const from = new Date(record.effectiveFrom).getTime();
  const to = record.effectiveTo ? new Date(record.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(from) && from <= instant && instant < to;
};

export const getEffectiveScheduleState = (records = [], asOf = new Date()) => {
  const instant = asDate(asOf).getTime();
  const ordered = [...records].sort(
    (left, right) => new Date(left.effectiveFrom).getTime() - new Date(right.effectiveFrom).getTime(),
  );
  const current = ordered.filter((record) => isEffectiveAt(record, instant)).at(-1) || null;
  const upcoming = ordered.find(
    (record) => record?.active !== false && new Date(record.effectiveFrom).getTime() > instant,
  ) || null;
  return { current, upcoming };
};

export const getCoreRuleModels = (schedule = {}) => {
  const definitions = Array.isArray(schedule?.definitions) ? schedule.definitions : [];
  const rules = Array.isArray(schedule?.rules) ? schedule.rules : [];
  return CORE_COMMERCIAL_RULES.map((metadata) => {
    const definition = definitions.find(
      (candidate) => candidate?.businessUnit === CORE_BUSINESS_UNIT && candidate?.key === metadata.key,
    );
    if (!definition) return null;
    const matchingRules = rules.filter(
      (rule) => rule?.businessUnit === CORE_BUSINESS_UNIT && rule?.key === metadata.key,
    );
    return {
      metadata,
      definition,
      records: matchingRules,
      ...getEffectiveScheduleState(matchingRules, schedule.asOf),
    };
  }).filter(Boolean);
};

const trimNumber = (value) => Number(value).toLocaleString("en-GH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCommercialRuleValue = (record, metadata = {}) => {
  if (!record) return "Not set";
  if (record.valueType === "BASIS_POINTS") return `${trimNumber(Number(record.value) / 100)}%`;
  if (record.valueType === "MONEY_CENTS") {
    return `GHS ${Number(record.value / 100).toLocaleString("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (record.valueType === "INTEGER") {
    return `${trimNumber(record.value)}${metadata.displayUnit ? ` ${metadata.displayUnit}` : ""}`;
  }
  return String(record.value ?? "Not set");
};

export const groupWaterPriceSchedule = (schedule = {}) => {
  const prices = Array.isArray(schedule?.waterPrices) ? schedule.waterPrices : [];
  const grouped = new Map();
  prices.forEach((price) => {
    const key = `${price.productKey}:${price.priceType}`;
    const records = grouped.get(key) || [];
    records.push(price);
    grouped.set(key, records);
  });

  return [...grouped.entries()].map(([key, records]) => {
    const state = getEffectiveScheduleState(records, schedule.asOf);
    const reference = state.current || state.upcoming || records[0];
    return { key, records, reference, ...state };
  }).sort((left, right) => {
    const nameOrder = String(left.reference?.productName || "")
      .localeCompare(String(right.reference?.productName || ""));
    return nameOrder || String(left.reference?.priceType || "")
      .localeCompare(String(right.reference?.priceType || ""));
  });
};

export const formatWaterPrice = (record) => {
  if (!record) return "Not set";
  const currency = String(record.currency || "GHS").toUpperCase();
  return `${currency} ${Number(record.priceCents / 100).toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const normalizeProductKey = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Product key must use lowercase letters, numbers, and single hyphens.");
  }
  return normalized;
};

export const buildWaterPricePayload = (draft = {}, reference = {}, now = new Date()) => {
  const productName = String(draft.productName || reference.productName || "").trim();
  if (!productName || productName.length > 160) {
    throw new Error("Enter a Water product name of 160 characters or fewer.");
  }
  const priceType = String(draft.priceType || reference.priceType || "").trim().toUpperCase();
  if (!WATER_PRICE_TYPE_VALUES.has(priceType)) {
    throw new Error("Choose a supported Water price type.");
  }
  const minimumQuantity = Number(String(draft.minimumQuantity ?? reference.minimumQuantity ?? "").trim());
  if (!Number.isInteger(minimumQuantity) || minimumQuantity < 1 || minimumQuantity > 100000) {
    throw new Error("Minimum quantity must be a whole number between 1 and 100000.");
  }
  const currency = String(draft.currency || reference.currency || "GHS").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a three-letter ISO code such as GHS.");
  }
  const payload = {
    resourceType: "water_price",
    productKey: normalizeProductKey(draft.productKey || reference.productKey),
    productName,
    priceType,
    minimumQuantity,
    priceCents: Math.round(parseDecimal(draft.price, "New price", { positive: true }) * 100),
    currency,
  };
  const effectiveFrom = toEffectiveFrom(draft.effectiveDate, now);
  if (effectiveFrom) payload.effectiveFrom = effectiveFrom;
  const productId = Number(reference.productId);
  if (Number.isInteger(productId) && productId > 0) payload.productId = productId;
  return payload;
};
