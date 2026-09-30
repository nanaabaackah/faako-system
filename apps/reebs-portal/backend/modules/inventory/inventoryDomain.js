export const INVENTORY_ERROR_CODES = Object.freeze({
  NOT_FOUND: "INVENTORY_NOT_FOUND",
  INSUFFICIENT: "INSUFFICIENT_INVENTORY",
  INVALID_ADJUSTMENT: "INVALID_STOCK_ADJUSTMENT",
  INVALID_STATE: "INVALID_INVENTORY_STATE",
  CONFLICT: "INVENTORY_CONFLICT",
  SCOPE_CONFLICT: "INVENTORY_SCOPE_CONFLICT",
});

export const STOCK_MOVEMENT_TYPES = Object.freeze({
  IN: "StockIn",
  OUT: "StockOut",
});

export const INVENTORY_ADJUSTMENT_REASONS = new Set([
  "RECEIVE",
  "REMOVE",
  "RETURN",
  "CORRECTION",
  "CAPACITY_CORRECTION",
  "DAMAGE",
  "LOSS",
  "DISPOSAL",
]);

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";

export const normalizeStockMovementType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "stockin") return STOCK_MOVEMENT_TYPES.IN;
  if (normalized === "stockout") return STOCK_MOVEMENT_TYPES.OUT;
  return "";
};

export const parsePositiveInventoryInteger = (value) => {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};

export const normalizeInventoryIdempotencyKey = (value) => {
  const key = cleanText(value, 160);
  if (!key) return "";
  return key.length >= 8 ? key : null;
};

export const normalizeSoldMonth = (value) => {
  if (value == null || value === "") return null;
  const normalized = cleanText(value, 10);
  if (/^\d{4}-\d{2}$/.test(normalized)) return `${normalized}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  return undefined;
};

export const normalizeInventoryAdjustment = (input = {}) => {
  const productId = parsePositiveInventoryInteger(input.productId);
  const variantId = input.variantId == null || input.variantId === ""
    ? null
    : parsePositiveInventoryInteger(input.variantId);
  const quantity = parsePositiveInventoryInteger(input.quantity);
  const type = normalizeStockMovementType(input.type);
  const idempotencyKey = normalizeInventoryIdempotencyKey(input.idempotencyKey);
  const soldMonth = normalizeSoldMonth(input.soldMonth);
  const defaultReason = type === STOCK_MOVEMENT_TYPES.IN ? "RECEIVE" : "REMOVE";
  const reasonCode = cleanText(input.reasonCode || defaultReason, 40).toUpperCase();

  if (!productId) return { error: "Choose a valid inventory item." };
  if (input.variantId != null && input.variantId !== "" && !variantId) {
    return { error: "Choose a valid inventory variant." };
  }
  if (!type) return { error: "Choose Add stock or Remove stock." };
  if (!quantity) return { error: "Quantity must be a positive whole number." };
  if (idempotencyKey === null) return { error: "The adjustment request key is invalid." };
  if (soldMonth === undefined) return { error: "Month sold must use YYYY-MM or YYYY-MM-DD." };
  if (!INVENTORY_ADJUSTMENT_REASONS.has(reasonCode)) {
    return { error: "Choose a supported reason for this stock change." };
  }

  return {
    value: {
      productId,
      variantId,
      quantity,
      type,
      delta: type === STOCK_MOVEMENT_TYPES.IN ? quantity : -quantity,
      idempotencyKey: idempotencyKey || null,
      soldMonth,
      reasonCode,
      notes: cleanText(input.notes, 500) || null,
      reference: cleanText(input.reference, 160) || null,
    },
  };
};

export const createInventoryError = (message, { statusCode = 400, code } = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code || INVENTORY_ERROR_CODES.INVALID_ADJUSTMENT;
  return error;
};

export const serializeAdjustmentReplay = (movement) => ({
  message: "This stock adjustment was already applied.",
  idempotentReplay: true,
  productId: Number(movement.productId),
  variantId: movement.variantId == null ? null : Number(movement.variantId),
  newStock: Number(movement.resultingStock),
  movementId: Number(movement.id),
});
