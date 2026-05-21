import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cataloguePath = path.resolve(__dirname, "../../src/data/stroaneCatalogue.json");
const catalogue = JSON.parse(readFileSync(cataloguePath, "utf8"));

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

const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
};

const toPublicCategory = (category) => ({
  id: category.slug,
  name: category.name,
  description: category.description || "",
  tags: asArray(category.tags),
});

const toPublicProduct = (product) => ({
  id: product.slug,
  name: product.name,
  category: product.category?.name || product.categorySlug || "Catalogue",
  categorySlug: product.categorySlug || product.category?.slug || "",
  subcategory: product.subcategory || undefined,
  brand: product.brand || undefined,
  sku: product.sku || product.slug,
  description: product.shortDescription || "",
  longDescription: product.longDescription || undefined,
  price: product.price == null ? null : Number(product.price),
  priceLabel: product.priceLabel || undefined,
  currency: product.currency || "GHS",
  unit: product.unit || "each",
  image: product.image || undefined,
  images: asArray(product.images),
  tag: product.tag || undefined,
  stock: normalizeStockLabel(product.stockStatus),
  stockStatus: normalizeStockStatus(product.stockStatus),
  stockQuantity: toNullableInteger(product.stockQuantity),
  lowStockThreshold: toNullableInteger(product.lowStockThreshold),
  allowBackorder: Boolean(product.allowBackorder),
  isPurchasable: Boolean(product.isPurchasable),
  availability: product.availability || undefined,
  quoteOnly: Boolean(product.quoteOnly || product.price == null),
  features: asArray(product.features),
  specifications: asObject(product.specifications),
  tags: asArray(product.tags),
  useCases: asArray(product.useCases),
  inquiryCta: product.inquiryCta || undefined,
  sourceRefs: asArray(product.sourceRefs),
});

export const getBusinessProfile = () => clone(catalogue.businessProfile);

export const listCatalogueCategories = () => clone(catalogue.categories);

export const listCatalogueProducts = ({ category = "", search = "" } = {}) => {
  const categoryQuery = normalizeText(category);
  const searchQuery = normalizeText(search);

  return clone(
    catalogue.products.filter((product) => {
      const matchesCategory =
        !categoryQuery ||
        normalizeText(product.category) === categoryQuery ||
        normalizeText(product.categorySlug) === categoryQuery;

      const haystack = normalizeText(
        [
          product.name,
          product.category,
          product.subcategory,
          product.brand,
          product.sku,
          product.description,
          ...(product.tags || []),
          ...(product.useCases || []),
        ].join(" ")
      );

      return matchesCategory && (!searchQuery || haystack.includes(searchQuery));
    })
  );
};

export const getCatalogueProductBySlug = (slug = "") => {
  if (!isValidSlug(slug)) return null;
  const product = catalogue.products.find((item) => item.id === slug || item.slug === slug);
  return product ? clone(product) : null;
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
    where: { isPublished: true },
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

      const haystack = normalizeText(
        [
          product.name,
          product.category,
          product.subcategory,
          product.brand,
          product.sku,
          product.description,
          ...(product.tags || []),
          ...(product.useCases || []),
        ].join(" ")
      );

      return matchesCategory && (!searchQuery || haystack.includes(searchQuery));
    });
};

export const getPersistedCatalogueProductBySlug = async (prisma, slug = "") => {
  if (!isValidSlug(slug) || !prisma?.catalogueProduct?.findFirst) return null;

  const product = await prisma.catalogueProduct.findFirst({
    where: {
      isPublished: true,
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
