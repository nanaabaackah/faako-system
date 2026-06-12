import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(__dirname, "../../src/data/stroaneCatalogue.json");
const catalogue = JSON.parse(readFileSync(cataloguePath, "utf8"));
const localCategoryById = new Map(catalogue.categories.map((category) => [category.id, category]));
const localProductById = new Map(catalogue.products.map((product) => [product.id, product]));

const clone = (value) => JSON.parse(JSON.stringify(value));

const normalizeText = (value = "") => String(value || "").trim().toLowerCase();

const sanitizeText = (value, maxLength) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const isValidSlug = (value = "") => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value));

const isLikelyEmail = (value = "") =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));

const asArray = (value) => (Array.isArray(value) ? value : []);

const asObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const stockStatusLabels = {
  in_stock: "In stock",
  low_stock: "Few left",
  out_of_stock: "Out of stock",
  pre_order: "Preorder",
  preorder: "Preorder",
  unavailable: "Unavailable",
  manual_review: "Unavailable",
  price_required: "Unavailable",
  quote_required: "Unavailable",
};

const normalizeStockLabel = (value = "") =>
  stockStatusLabels[
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  ] || "Unavailable";

export const normalizeStockStatus = (value = "") => {
  const normalized = String(value || "unavailable")
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

const resolveStockStatus = (value, availableQuantity) => {
  const stockStatus = normalizeStockStatus(value);
  if (stockStatus === "preorder") return stockStatus;
  if (availableQuantity != null && availableQuantity <= 0) return "out_of_stock";
  return stockStatus;
};

const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
};

const toPublicCategory = (category) => {
  const categoryId = category.slug || category.id;
  const localCategory = localCategoryById.get(categoryId) || {};

  return {
    id: categoryId,
    name: category.name || localCategory.name,
    description: category.description || localCategory.description || "",
    tags: asArray(category.tags).length ? asArray(category.tags) : asArray(localCategory.tags),
    parentId: localCategory.parentId ?? null,
    sortOrder: Number.isInteger(category.sortOrder) ? category.sortOrder : localCategory.sortOrder,
    isGroup: Boolean(localCategory.isGroup),
  };
};

const toPublicProduct = (product) => {
  const productId = product.slug || product.id;
  const localProduct = localProductById.get(productId) || {};
  const images = asArray(product.images).length ? asArray(product.images) : asArray(localProduct.images);
  const specifications =
    product.specifications !== undefined ? product.specifications : localProduct.specifications;
  const stockQuantity = toNullableInteger(product.stockQuantity ?? localProduct.stockQuantity);
  const reservedQuantity = toNullableInteger(product.reservedQuantity ?? localProduct.reservedQuantity);
  const explicitAvailableQuantity = toNullableInteger(
    product.availableQuantity ?? localProduct.availableQuantity
  );
  const availableQuantity =
    explicitAvailableQuantity != null
      ? explicitAvailableQuantity
      : stockQuantity == null
        ? null
        : Math.max(0, stockQuantity - (reservedQuantity ?? 0));
  const stockStatus = resolveStockStatus(
    product.stockStatus || localProduct.stockStatus,
    availableQuantity
  );

  return {
    id: productId,
    name: product.name,
    productType: localProduct.productType || "standalone",
    category: product.category?.name || localProduct.category || product.categorySlug || "Catalogue",
    categorySlug: product.categorySlug || product.category?.slug || localProduct.categorySlug || "",
    subcategory: product.subcategory || localProduct.subcategory || undefined,
    brand: product.brand || localProduct.brand || undefined,
    sku: product.sku || localProduct.sku || productId,
    description: product.shortDescription || localProduct.description || "",
    longDescription: product.longDescription || localProduct.longDescription || undefined,
    price: product.price == null ? null : Number(product.price),
    compareAtPrice: product.compareAtPrice == null ? null : Number(product.compareAtPrice),
    priceLabel: product.priceLabel || localProduct.priceLabel || undefined,
    currency: product.currency || localProduct.currency || "GHS",
    unit: product.unit || localProduct.unit || "each",
    image: product.image || localProduct.image || undefined,
    thumbnailUrl: localProduct.thumbnailUrl || product.image || undefined,
    imageUrl: localProduct.imageUrl || product.image || undefined,
    images,
    galleryImages: asArray(localProduct.galleryImages).length ? localProduct.galleryImages : images,
    media: asArray(localProduct.media),
    tag: product.tag || localProduct.tag || undefined,
    stock: normalizeStockLabel(stockStatus),
    stockStatus,
    stockQuantity,
    availableQuantity,
    reservedQuantity,
    lowStockThreshold: toNullableInteger(product.lowStockThreshold ?? localProduct.lowStockThreshold),
    allowBackorder: Boolean(product.allowBackorder ?? localProduct.allowBackorder),
    isPurchasable: Boolean(product.isPurchasable ?? localProduct.isPurchasable),
    availability: product.availability || localProduct.availability || undefined,
    quoteOnly: Boolean(product.quoteOnly || product.price == null),
    reorderThreshold: toNullableInteger(product.reorderThreshold ?? localProduct.reorderThreshold),
    variants: asArray(localProduct.variants),
    features: asArray(product.features).length ? asArray(product.features) : asArray(localProduct.features),
    specifications: Array.isArray(specifications) ? specifications : asObject(specifications),
    tags: asArray(product.tags).length ? asArray(product.tags) : asArray(localProduct.tags),
    useCases: asArray(product.useCases).length ? asArray(product.useCases) : asArray(localProduct.useCases),
    inquiryCta: product.inquiryCta || localProduct.inquiryCta || undefined,
  };
};

const flattenProductSearchTerms = (product) => {
  const specificationTerms = Array.isArray(product.specifications)
    ? product.specifications.flatMap((specification) => [
        specification.label,
        specification.value,
        specification.group,
      ])
    : Object.entries(asObject(product.specifications)).flatMap(([label, value]) => [label, value]);

  const variantTerms = asArray(product.variants).flatMap((variant) => [
    variant.name,
    variant.sku,
    ...Object.values(asObject(variant.options)),
  ]);

  return [
    product.name,
    product.category,
    product.subcategory,
    product.brand,
    product.sku,
    product.description,
    ...asArray(product.tags),
    ...asArray(product.useCases),
    ...specificationTerms,
    ...variantTerms,
  ];
};

export const getBusinessProfile = () => clone(catalogue.businessProfile);

export const listCatalogueCategories = () => clone(catalogue.categories);

export const listCatalogueProducts = ({ category = "", search = "" } = {}) => {
  const categoryQuery = normalizeText(category);
  const searchQuery = normalizeText(search);

  return clone(
    catalogue.products
      .filter((product) => {
      const matchesCategory =
        !categoryQuery ||
        normalizeText(product.category) === categoryQuery ||
        normalizeText(product.categorySlug) === categoryQuery;

      const haystack = normalizeText(flattenProductSearchTerms(product).join(" "));

      return matchesCategory && (!searchQuery || haystack.includes(searchQuery));
      })
      .map(toPublicProduct)
  );
};

export const getCatalogueProductBySlug = (slug = "") => {
  if (!isValidSlug(slug)) return null;
  const product = catalogue.products.find((item) => item.id === slug || item.slug === slug);
  return product ? clone(toPublicProduct(product)) : null;
};

export const listPersistedCatalogueCategories = async (prisma) => {
  if (!prisma?.catalogueCategory?.findMany) return [];

  const categories = await prisma.catalogueCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return categories.map(toPublicCategory);
};

export const listPersistedCatalogueProducts = async (
  prisma,
  { category = "", search = "" } = {}
) => {
  if (!prisma?.catalogueProduct?.findMany) return [];

  const products = await prisma.catalogueProduct.findMany({
    where: { isPublished: true, publishingStatus: "active" },
    include: { category: true },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });

  const categoryQuery = normalizeText(category);
  const searchQuery = normalizeText(search);

  return products
    .map(toPublicProduct)
    .filter((product) => {
      const matchesCategory =
        !categoryQuery ||
        normalizeText(product.category) === categoryQuery ||
        normalizeText(product.categorySlug) === categoryQuery;

      const haystack = normalizeText(flattenProductSearchTerms(product).join(" "));

      return matchesCategory && (!searchQuery || haystack.includes(searchQuery));
    });
};

export const getPersistedCatalogueProductBySlug = async (prisma, slug = "") => {
  if (!isValidSlug(slug) || !prisma?.catalogueProduct?.findFirst) return null;

  const product = await prisma.catalogueProduct.findFirst({
    where: {
      isPublished: true,
      publishingStatus: "active",
      OR: [{ slug }, { sku: slug }],
    },
    include: { category: true },
  });

  return product ? toPublicProduct(product) : null;
};

export const createCatalogueInquiry = (payload = {}) => {
  const name = sanitizeText(payload.name, 120);
  const email = sanitizeText(payload.email, 160);
  const phone = sanitizeText(payload.phone, 60);
  const businessName = sanitizeText(payload.businessName, 160);
  const message = sanitizeText(payload.message, 1200);
  const productSlug = sanitizeText(payload.productSlug, 120);
  const productName = sanitizeText(payload.productName, 180);
  const source = sanitizeText(payload.source, 80) || "catalogue";
  const honeypot = sanitizeText(payload.website || payload.companyWebsite, 200);

  const errors = [];
  if (!name) errors.push("Name is required.");
  if (!email && !phone) errors.push("Provide an email or phone number.");
  if (!isLikelyEmail(email)) errors.push("Email is invalid.");
  if (!message || message.length < 5) errors.push("Message is required.");
  if (productSlug && !isValidSlug(productSlug)) errors.push("Product reference is invalid.");
  if (honeypot) errors.push("Invalid inquiry payload.");

  if (errors.length) {
    const error = new Error("Invalid inquiry payload.");
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const product = productSlug ? getCatalogueProductBySlug(productSlug) : null;
  const receivedAt = new Date().toISOString();

  return {
    inquiry: {
      id: `inq_${randomUUID()}`,
      status: "received",
      receivedAt,
      productSlug: product?.id || productSlug || undefined,
      productName: product?.name || productName || undefined,
      source,
      nextStep:
        "Inquiry received. Stroane will confirm product availability, pricing, and the best next step before any order is finalized.",
    },
    safeContactSummary: {
      name,
      email: email || undefined,
      phone: phone || undefined,
      businessName: businessName || undefined,
    },
    message,
  };
};

export const toCatalogueInquiryRecord = (inquiryResult, { userAgent = "" } = {}) => ({
  id: inquiryResult.inquiry.id,
  status: "RECEIVED",
  name: inquiryResult.safeContactSummary.name,
  email: inquiryResult.safeContactSummary.email || null,
  phone: inquiryResult.safeContactSummary.phone || null,
  businessName: inquiryResult.safeContactSummary.businessName || null,
  message: inquiryResult.message,
  productSlug: inquiryResult.inquiry.productSlug || null,
  productName: inquiryResult.inquiry.productName || null,
  source: inquiryResult.inquiry.source || "catalogue",
  userAgent: sanitizeText(userAgent, 240) || null,
});
