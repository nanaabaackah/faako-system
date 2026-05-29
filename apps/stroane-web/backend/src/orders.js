import { randomUUID } from "node:crypto";
import {
  getCatalogueProductBySlug,
  listPersistedCatalogueProducts,
  normalizeStockStatus,
} from "./catalogue.js";

const MAX_ORDER_QUANTITY = 99;

const sanitizeText = (value, maxLength) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const isLikelyEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

const toMoneyNumber = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0;
};

const toOrderStatus = (value = "PAYMENT_PENDING") =>
  String(value || "PAYMENT_PENDING").trim().toLowerCase();

const toPaymentStatus = (value = "payment_pending") =>
  String(value || "payment_pending").trim().toLowerCase();

const normalizePreferredContactMethod = (value = "email") => {
  const normalized = String(value || "email").trim().toLowerCase();
  return ["email", "phone", "whatsapp"].includes(normalized) ? normalized : "email";
};

const compactObject = (value = {}) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const toSafeOrderLog = (error) => ({
  message: String(error?.message || "Unknown order error")
    .replace(/\s+/g, " ")
    .slice(0, 180),
  code: typeof error?.code === "string" ? error.code.slice(0, 40) : undefined,
});

const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : null;
};

const getAvailableQuantity = (product) => {
  const explicitAvailableQuantity = toNullableInteger(product.availableQuantity);
  if (explicitAvailableQuantity != null) return explicitAvailableQuantity;

  const stockQuantity = toNullableInteger(product.stockQuantity);
  if (stockQuantity == null) return null;

  const reservedQuantity = toNullableInteger(product.reservedQuantity) ?? 0;
  return Math.max(0, stockQuantity - reservedQuantity);
};

const createOrderNumber = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  return `STR-${date}-${suffix}`;
};

const getCatalogueProductsForOrder = async (prisma) => {
  try {
    const products = await listPersistedCatalogueProducts(prisma);
    if (products.length) return products;
  } catch (error) {
    console.warn("Using seed catalogue for order pricing:", toSafeOrderLog(error));
  }

  return [];
};

const resolveOrderProduct = async (prisma, productSlug) => {
  const persistedProducts = await getCatalogueProductsForOrder(prisma);
  const persistedProduct = persistedProducts.find((product) => product.id === productSlug);
  return persistedProduct || getCatalogueProductBySlug(productSlug);
};

const getPurchaseBlocker = (product, quantity) => {
  if (product.quoteOnly || typeof product.price !== "number") {
    return `${product.name} requires a price request before checkout.`;
  }

  const stockStatus = normalizeStockStatus(product.stockStatus || product.stock);
  const availableQuantity = getAvailableQuantity(product);

  if (!product.isPurchasable) {
    return `${product.name} is not enabled for online purchase until stock is confirmed.`;
  }
  if (stockStatus === "out_of_stock") return `${product.name} is out of stock.`;
  if (stockStatus === "unavailable") return `${product.name} is unavailable for online purchase.`;
  if (stockStatus === "preorder" && !product.allowBackorder) {
    return `${product.name} is not available for preorder.`;
  }
  if ((stockStatus === "in_stock" || stockStatus === "low_stock") && availableQuantity == null) {
    return `${product.name} needs a confirmed stock quantity before checkout.`;
  }
  if (availableQuantity != null && availableQuantity < quantity && !product.allowBackorder) {
    return `${product.name} only has ${availableQuantity} available.`;
  }

  return "";
};

const validateCheckoutPayload = (payload = {}) => {
  const customer = payload.customer || {};
  const website = sanitizeText(payload.website, 200);
  const name = sanitizeText(customer.name, 120);
  const email = sanitizeText(customer.email, 160);
  const phone = sanitizeText(customer.phone, 60);
  const preferredContactMethod = normalizePreferredContactMethod(customer.preferredContactMethod);
  const businessName = sanitizeText(customer.businessName, 160);
  const deliveryAddress = sanitizeText(customer.deliveryAddress, 240);
  const deliveryNotes = sanitizeText(customer.deliveryNotes, 500);
  const items = Array.isArray(payload.items) ? payload.items : [];

  const errors = [];
  if (website) errors.push("Invalid checkout payload.");
  if (!name) errors.push("Name is required.");
  if (!email || !isLikelyEmail(email)) errors.push("A valid email is required.");
  if (!phone) errors.push("Phone is required.");
  if (!deliveryAddress) errors.push("Delivery address is required.");
  if (!items.length) errors.push("Add at least one product to checkout.");

  const normalizedItems = items
    .map((item) => ({
      productSlug: sanitizeText(item?.productSlug, 120),
      quantity: Number(item?.quantity),
    }))
    .filter((item) => item.productSlug);

  for (const item of normalizedItems) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_ORDER_QUANTITY) {
      errors.push("Item quantities must be between 1 and 99.");
      break;
    }
  }

  if (normalizedItems.length !== items.length) {
    errors.push("One or more order items are invalid.");
  }

  if (errors.length) {
    const error = new Error("Invalid checkout payload.");
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    customer: {
      name,
      email,
      phone,
      preferredContactMethod,
      businessName: businessName || null,
      deliveryAddress,
      deliveryNotes: deliveryNotes || null,
    },
    items: normalizedItems,
    source: sanitizeText(payload.source, 80) || "checkout",
  };
};

export const prepareCommerceOrder = async (prisma, payload = {}) => {
  const normalized = validateCheckoutPayload(payload);
  const lines = [];

  for (const item of normalized.items) {
    const product = await resolveOrderProduct(prisma, item.productSlug);
    if (!product) {
      const error = new Error(`Product is unavailable: ${item.productSlug}`);
      error.statusCode = 400;
      throw error;
    }

    const purchaseBlocker = getPurchaseBlocker(product, item.quantity);
    if (purchaseBlocker) {
      const error = new Error(purchaseBlocker);
      error.statusCode = 400;
      throw error;
    }

    const unitPrice = toMoneyNumber(product.price);
    const lineTotal = toMoneyNumber(unitPrice * item.quantity);
    lines.push({
      productSlug: product.id,
      productName: product.name,
      sku: product.sku || null,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      currency: product.currency || "GHS",
      snapshot: compactObject({
        category: product.category,
        brand: product.brand,
        unit: product.unit,
        stockStatus: normalizeStockStatus(product.stockStatus || product.stock),
        stockQuantity: toNullableInteger(product.stockQuantity),
        availableQuantity: getAvailableQuantity(product),
        reservedQuantity: toNullableInteger(product.reservedQuantity),
        sourceRefs: product.sourceRefs || [],
      }),
    });
  }

  const subtotal = toMoneyNumber(lines.reduce((sum, item) => sum + item.lineTotal, 0));

  return {
    orderNumber: createOrderNumber(),
    status: "PAYMENT_PENDING",
    customer: normalized.customer,
    source: normalized.source,
    currency: "GHS",
    subtotal,
    total: subtotal,
    paymentProvider: "paystack",
    paymentStatus: "not_started",
    paymentReference: null,
    lines,
  };
};

export const validateCommerceOrderPaymentReadiness = async (prisma, order) => {
  if (!order?.items?.length) {
    const error = new Error("Order has no checkout items.");
    error.statusCode = 409;
    throw error;
  }

  for (const item of order.items) {
    const product = await resolveOrderProduct(prisma, item.productSlug);
    if (!product) {
      const error = new Error(`${item.productName || item.productSlug} is no longer available.`);
      error.statusCode = 409;
      throw error;
    }

    const purchaseBlocker = getPurchaseBlocker(product, item.quantity);
    if (purchaseBlocker) {
      const error = new Error(purchaseBlocker);
      error.statusCode = 409;
      throw error;
    }

    const currentUnitPrice = toMoneyNumber(product.price);
    const currentLineTotal = toMoneyNumber(currentUnitPrice * item.quantity);
    const storedUnitPrice = toMoneyNumber(item.unitPrice);
    const storedLineTotal = toMoneyNumber(item.lineTotal);

    if (
      currentUnitPrice !== storedUnitPrice ||
      currentLineTotal !== storedLineTotal ||
      String(product.currency || "GHS") !== String(item.currency || "GHS")
    ) {
      const error = new Error(
        `${product.name} pricing changed before payment. Please refresh the basket and checkout again.`
      );
      error.statusCode = 409;
      throw error;
    }
  }

  return true;
};

export const toPublicCommerceOrder = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  status: toOrderStatus(order.status),
  preferredContactMethod: order.preferredContactMethod || undefined,
  currency: order.currency || "GHS",
  subtotal: toMoneyNumber(order.subtotal),
  total: toMoneyNumber(order.total),
  paymentStatus: toPaymentStatus(order.paymentStatus),
  paymentReference: order.paymentReference || undefined,
  createdAt: order.createdAt instanceof Date ? order.createdAt.toISOString() : order.createdAt,
  paidAt: order.paidAt instanceof Date ? order.paidAt.toISOString() : order.paidAt || undefined,
  nextStep:
    "Order request received. Stroane will confirm availability, delivery, and payment instructions before fulfillment.",
  items: (order.items || []).map((item) => ({
    productSlug: item.productSlug,
    productName: item.productName,
    sku: item.sku || undefined,
    quantity: item.quantity,
    unitPrice: toMoneyNumber(item.unitPrice),
    lineTotal: toMoneyNumber(item.lineTotal),
  })),
});

export const buildPaystackPreparation = () => ({
  provider: "paystack",
  status: "not_started",
  reference: null,
  nextStep:
    "Future Paystack payment links must be created server-side after order validation, with webhook verification before marking an order paid.",
});
