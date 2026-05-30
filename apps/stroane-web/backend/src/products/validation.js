import { createHttpError } from "../apiResponse.js";
import { normalizeSlug, parseLimit, sanitizeNullableText, sanitizeText } from "../inventory/validation.js";

export const PRODUCT_PUBLISHING_STATUSES = new Set(["draft", "active", "archived"]);

const PRODUCT_IMAGE_PATH_PATTERN =
  /^\/imgs\/products\/[a-zA-Z0-9][a-zA-Z0-9/_-]*\.(?:avif|gif|jpe?g|png|webp)$/i;

const parseBoolean = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (typeof value === "boolean") return value;
  if (String(value).toLowerCase() === "true") return true;
  if (String(value).toLowerCase() === "false") return false;
  throw createHttpError(`${fieldName} must be true or false.`);
};

const parseMoney = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw createHttpError(`${fieldName} must be a positive amount or zero.`);
  }
  return parsed.toFixed(2);
};

const parseCurrency = (value) => {
  if (value === undefined) return undefined;
  const normalized = sanitizeText(value, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw createHttpError("Currency must be a three-letter code.");
  }
  return normalized;
};

const parseTextList = (value, fieldName, { maxItems = 20, maxLength = 80 } = {}) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw createHttpError(`${fieldName} must be a list.`);

  return [...new Set(
    value
      .slice(0, maxItems)
      .map((item) => sanitizeText(item, maxLength))
      .filter(Boolean)
  )];
};

export const normalizeProductImagePath = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace(/\/+/g, "/");

  if (
    !PRODUCT_IMAGE_PATH_PATTERN.test(normalized) ||
    normalized.includes("..") ||
    normalized.includes("\\") ||
    normalized.includes("?") ||
    normalized.includes("#")
  ) {
    throw createHttpError(
      "Product images must use a safe /imgs/products/ path with a supported image extension."
    );
  }

  return normalized;
};

export const validateProductPatchPayload = (body = {}) => {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    data.name = sanitizeText(body.name, 180);
    if (!data.name) throw createHttpError("Product name is required.");
  }

  if (Object.prototype.hasOwnProperty.call(body, "slug")) {
    data.slug = normalizeSlug(body.slug, 180);
    if (!data.slug) throw createHttpError("Product slug is invalid.");
  }

  if (Object.prototype.hasOwnProperty.call(body, "shortDescription")) {
    data.shortDescription = sanitizeNullableText(body.shortDescription, 320);
  }

  if (Object.prototype.hasOwnProperty.call(body, "longDescription")) {
    data.longDescription = sanitizeNullableText(body.longDescription, 2400);
  }

  if (Object.prototype.hasOwnProperty.call(body, "sku")) {
    data.sku = sanitizeNullableText(body.sku, 120);
  }

  if (Object.prototype.hasOwnProperty.call(body, "price")) {
    data.price = parseMoney(body.price, "Price");
  }

  if (Object.prototype.hasOwnProperty.call(body, "compareAtPrice")) {
    data.compareAtPrice = parseMoney(body.compareAtPrice, "Compare-at price");
  }

  if (Object.prototype.hasOwnProperty.call(body, "currency")) {
    data.currency = parseCurrency(body.currency);
  }

  if (Object.prototype.hasOwnProperty.call(body, "categorySlug")) {
    data.categorySlug = body.categorySlug ? normalizeSlug(body.categorySlug, 160) : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "tags")) {
    data.tags = parseTextList(body.tags, "Product tags");
  }

  if (!Object.keys(data).length) {
    throw createHttpError("No valid product fields were provided.");
  }

  return data;
};

export const validateProductMediaPayload = (body = {}) => {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(body, "thumbnailImage")) {
    data.image = normalizeProductImagePath(body.thumbnailImage);
  }

  if (Object.prototype.hasOwnProperty.call(body, "galleryImages")) {
    if (!Array.isArray(body.galleryImages)) {
      throw createHttpError("Gallery images must be a list.");
    }
    data.images = [...new Set(
      body.galleryImages
        .slice(0, 12)
        .map(normalizeProductImagePath)
        .filter(Boolean)
    )];
  }

  if (!Object.keys(data).length) {
    throw createHttpError("No valid product media fields were provided.");
  }

  return data;
};

export const validateProductPublishingPayload = (body = {}) => {
  const data = {};

  if (Object.prototype.hasOwnProperty.call(body, "publishingStatus")) {
    const status = sanitizeText(body.publishingStatus, 40).toLowerCase();
    if (!PRODUCT_PUBLISHING_STATUSES.has(status)) {
      throw createHttpError("Product publishing status is not supported.");
    }
    data.publishingStatus = status;
    data.isPublished = status === "active";
  }

  if (Object.prototype.hasOwnProperty.call(body, "isFeatured")) {
    data.isFeatured = parseBoolean(body.isFeatured, "Featured");
  }

  if (!Object.keys(data).length) {
    throw createHttpError("No valid publishing fields were provided.");
  }

  return data;
};

export const validateProductSupplierPayload = (body = {}) => {
  if (!Object.prototype.hasOwnProperty.call(body, "supplierId")) {
    throw createHttpError("Supplier selection is required.");
  }

  const supplierId =
    body.supplierId === null || body.supplierId === ""
      ? null
      : sanitizeNullableText(body.supplierId, 120);

  return {
    supplierId,
    supplierSku: sanitizeNullableText(body.supplierSku || body.supplierProductCode, 120),
    notes: sanitizeNullableText(body.notes, 1200),
  };
};

export const validateAdminProductListQuery = (query = {}) => ({
  search: sanitizeText(query.search, 120),
  publishingStatus: sanitizeText(query.publishingStatus || query.status, 40).toLowerCase(),
  categorySlug: query.categorySlug ? normalizeSlug(query.categorySlug, 160) : "",
  tag: sanitizeText(query.tag, 80).toLowerCase(),
  limit: parseLimit(query.limit, 100, 200),
});
