import { createHttpError } from "../apiResponse.js";

export const STOCK_STATUSES = new Set([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "preorder",
  "unavailable",
  "manual_review",
]);

export const SUPPLIER_STATUSES = new Set(["active", "inactive", "archived"]);

export const MOVEMENT_TYPES = new Set([
  "RESTOCK",
  "ADJUSTMENT",
  "DAMAGE",
  "MANUAL_CORRECTION",
  "RESERVED",
  "RELEASED",
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sanitizeText = (value, maxLength = 240) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

export const sanitizeNullableText = (value, maxLength = 240) => {
  if (value === null) return null;
  if (value === undefined) return undefined;
  return sanitizeText(value, maxLength) || null;
};

export const normalizeSlug = (value, maxLength = 120) =>
  sanitizeText(value, maxLength)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);

const parseInteger = (value, fieldName, { nullable = true, min = 0 } = {}) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") {
    if (nullable) return null;
    throw createHttpError(`${fieldName} is required.`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw createHttpError(`${fieldName} must be an integer greater than or equal to ${min}.`);
  }

  return parsed;
};

const parseSignedInteger = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    throw createHttpError(`${fieldName} is required.`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw createHttpError(`${fieldName} must be an integer.`);
  }

  return parsed;
};

const parseBoolean = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (String(value).toLowerCase() === "true") return true;
  if (String(value).toLowerCase() === "false") return false;
  throw createHttpError(`${fieldName} must be true or false.`);
};

const parseDate = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(`${fieldName} must be a valid date.`);
  }
  return date;
};

const parseEmail = (value, fieldName) => {
  const email = sanitizeNullableText(value, 160);
  if (email && !EMAIL_PATTERN.test(email)) {
    throw createHttpError(`${fieldName} must be a valid email address.`);
  }
  return email;
};

const normalizeStatus = (value, allowedStatuses, fieldName) => {
  if (value === undefined) return undefined;
  const normalized = sanitizeText(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  if (!allowedStatuses.has(normalized)) {
    throw createHttpError(`${fieldName} is not supported.`);
  }
  return normalized;
};

export const parseLimit = (value, fallback = 50, max = 100) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
};

export const validateSupplierPayload = (body = {}, { partial = false } = {}) => {
  const data = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, "name")) {
    data.name = sanitizeText(body.name, 160);
    if (!data.name) throw createHttpError("Supplier name is required.");
  }

  if (Object.prototype.hasOwnProperty.call(body, "slug")) {
    data.slug = normalizeSlug(body.slug);
    if (!data.slug) throw createHttpError("Supplier slug is invalid.");
  }

  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    data.status = normalizeStatus(body.status, SUPPLIER_STATUSES, "Supplier status");
  }

  if (Object.prototype.hasOwnProperty.call(body, "email")) {
    data.email = parseEmail(body.email, "Supplier email");
  }

  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    data.phone = sanitizeNullableText(body.phone, 80);
  }

  if (Object.prototype.hasOwnProperty.call(body, "website")) {
    data.website = sanitizeNullableText(body.website, 200);
  }

  if (Object.prototype.hasOwnProperty.call(body, "location")) {
    data.location = sanitizeNullableText(body.location, 200);
  }

  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    data.notes = sanitizeNullableText(body.notes, 1200);
  }

  if (Object.prototype.hasOwnProperty.call(body, "contacts")) {
    if (!Array.isArray(body.contacts)) {
      throw createHttpError("Supplier contacts must be a list.");
    }

    data.contacts = body.contacts.slice(0, 10).map((contact, index) => {
      const name = sanitizeText(contact?.name, 120);
      if (!name) throw createHttpError(`Supplier contact ${index + 1} requires a name.`);
      return {
        name,
        role: sanitizeNullableText(contact?.role, 120),
        email: parseEmail(contact?.email, `Supplier contact ${index + 1} email`),
        phone: sanitizeNullableText(contact?.phone, 80),
        whatsapp: sanitizeNullableText(contact?.whatsapp, 80),
        isPrimary: Boolean(contact?.isPrimary),
        notes: sanitizeNullableText(contact?.notes, 600),
      };
    });
  }

  if (!Object.keys(data).length) {
    throw createHttpError("No valid supplier fields were provided.");
  }

  return data;
};

export const validateInventoryPatchPayload = (body = {}) => {
  const data = {};

  const quantityValue = Object.prototype.hasOwnProperty.call(body, "quantityOnHand")
    ? body.quantityOnHand
    : body.stockQuantity;

  if (
    Object.prototype.hasOwnProperty.call(body, "quantityOnHand") ||
    Object.prototype.hasOwnProperty.call(body, "stockQuantity")
  ) {
    data.quantityOnHand = parseInteger(quantityValue, "Quantity on hand");
  }

  if (Object.prototype.hasOwnProperty.call(body, "reservedQuantity")) {
    data.reservedQuantity = parseInteger(body.reservedQuantity, "Reserved quantity");
  }

  if (Object.prototype.hasOwnProperty.call(body, "reorderThreshold")) {
    data.reorderThreshold = parseInteger(body.reorderThreshold, "Reorder threshold");
  }

  if (Object.prototype.hasOwnProperty.call(body, "lowStockThreshold")) {
    data.lowStockThreshold = parseInteger(body.lowStockThreshold, "Low stock threshold");
  }

  if (Object.prototype.hasOwnProperty.call(body, "stockStatus")) {
    data.stockStatus = normalizeStatus(body.stockStatus, STOCK_STATUSES, "Stock status");
  }

  if (Object.prototype.hasOwnProperty.call(body, "allowBackorder")) {
    data.allowBackorder = parseBoolean(body.allowBackorder, "Allow backorder");
  }

  if (Object.prototype.hasOwnProperty.call(body, "isPurchasable")) {
    data.isPurchasable = parseBoolean(body.isPurchasable, "Purchasable");
  }

  if (Object.prototype.hasOwnProperty.call(body, "supplierId")) {
    data.supplierId = sanitizeNullableText(body.supplierId, 120);
  }

  if (Object.prototype.hasOwnProperty.call(body, "sku")) {
    data.sku = sanitizeNullableText(body.sku, 120);
  }

  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    data.notes = sanitizeNullableText(body.notes, 1200);
  }

  if (Object.prototype.hasOwnProperty.call(body, "lastCountedAt")) {
    data.lastCountedAt = parseDate(body.lastCountedAt, "Last counted at");
  }

  if (!Object.keys(data).length) {
    throw createHttpError("No valid inventory fields were provided.");
  }

  return data;
};

export const validateProductInventoryPatchPayload = (body = {}) => {
  const data = validateInventoryPatchPayload(body);

  if (Object.prototype.hasOwnProperty.call(body, "variantId")) {
    data.variantId = sanitizeNullableText(body.variantId, 120);
  }

  if (Object.prototype.hasOwnProperty.call(body, "syncInventoryItem")) {
    data.syncInventoryItem = parseBoolean(body.syncInventoryItem, "Sync inventory item");
  }

  return data;
};

export const validateMovementPayload = (body = {}) => {
  const movementType = sanitizeText(body.movementType || body.type, 80).toUpperCase();
  if (!MOVEMENT_TYPES.has(movementType)) {
    throw createHttpError("Inventory movement type is not supported.");
  }

  const quantityDelta = Object.prototype.hasOwnProperty.call(body, "quantityDelta")
    ? parseSignedInteger(body.quantityDelta, "Quantity delta")
    : parseSignedInteger(body.quantity, "Quantity");

  const data = {
    movementType,
    quantityDelta,
    inventoryItemId: sanitizeNullableText(body.inventoryItemId, 120),
    productSlug: normalizeSlug(body.productSlug || "", 160) || undefined,
    variantId: sanitizeNullableText(body.variantId, 120),
    supplierId: sanitizeNullableText(body.supplierId, 120),
    quantityAfter: Object.prototype.hasOwnProperty.call(body, "quantityAfter")
      ? parseInteger(body.quantityAfter, "Quantity after", { nullable: false })
      : undefined,
    reason: sanitizeNullableText(body.reason, 400),
    referenceType: sanitizeNullableText(body.referenceType, 80),
    referenceId: sanitizeNullableText(body.referenceId, 120),
    supplierNote: sanitizeNullableText(body.supplierNote, 700),
    purchaseNote: sanitizeNullableText(body.purchaseNote, 700),
  };

  if (!data.inventoryItemId && !data.productSlug) {
    throw createHttpError("Inventory movement requires an inventory item or product slug.");
  }

  if (["RESTOCK", "DAMAGE", "RESERVED", "RELEASED"].includes(movementType) && quantityDelta <= 0) {
    throw createHttpError(`${movementType} movements require a positive quantity.`);
  }

  return data;
};

export const validateListQuery = (query = {}) => ({
  search: sanitizeText(query.search, 120),
  status: sanitizeText(query.status || query.stockStatus, 80)
    .toLowerCase()
    .replace(/[\s-]+/g, "_"),
  supplierId: sanitizeText(query.supplierId, 120),
  productSlug: sanitizeText(query.productSlug, 160),
  movementType: sanitizeText(query.movementType || query.type, 80).toUpperCase(),
  limit: parseLimit(query.limit),
});
