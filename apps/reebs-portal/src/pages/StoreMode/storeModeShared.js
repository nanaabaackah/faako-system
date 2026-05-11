import {
  clearLocalDraft,
  readLocalDraft,
  writeLocalDraft,
} from "@faako/offline-sync";
import {
  applyInventoryLineQuantityDelta,
  buildProductSearchText,
  buildVariantOptionLabel,
  findVariantById,
  formatVariantLabel,
  getActiveItemVariants,
  getBaseItemPrice,
  getProductAvailableQty,
  getProductLineKey,
  getVariantAvailableQty,
  getVariantUnitPrice,
  isVariantParentItem,
} from "../../utils/productVariants";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOW_STOCK_THRESHOLD = 3;

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash" },
  { value: "momo", label: "MoMo" },
];

const DISCOUNT_OPTIONS = [
  { value: "amount", label: "Amount" },
  { value: "percent", label: "%" },
];

const getQuantity = (item, quantityByLineKey = new Map()) =>
  getProductAvailableQty(item, quantityByLineKey);

const getAvailableQuantity = (item, quantityByLineKey = new Map()) =>
  getProductAvailableQty(item, quantityByLineKey);

const getUnitPrice = (item) => getBaseItemPrice(item);

const getCategory = (item) =>
  item?.specificCategory || item?.specificcategory || item?.sourceCategoryCode || "General";

const isSaleableProduct = (item) => {
  const source = String(item?.sourceCategoryCode || item?.sourcecategorycode || "")
    .trim()
    .toLowerCase();
  return source !== "rental";
};

const formatMoney = (value, currency = "GHS") => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
};

const normalizeText = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const normalizePhoneDigits = (value) => String(value || "").replace(/\D/g, "");

const parseReceiptContact = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return { channel: "", value: "", email: "", phone: "", isValid: false };
  }
  if (EMAIL_PATTERN.test(normalized)) {
    const email = normalized.toLowerCase();
    return { channel: "email", value: email, email, phone: "", isValid: true };
  }
  const digits = normalizePhoneDigits(normalized);
  if (digits.length >= 9) {
    return { channel: "whatsapp", value: normalized, email: "", phone: normalized, isValid: true };
  }
  return { channel: "", value: normalized, email: "", phone: "", isValid: false };
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const sortCustomersByName = (customers) =>
  [...customers].sort((left, right) =>
    String(left?.name || left?.email || left?.phone || "").localeCompare(
      String(right?.name || right?.email || right?.phone || "")
    )
  );

const getCustomerLabel = (customer) =>
  customer?.name || customer?.email || customer?.phone || `Customer #${customer?.id ?? ""}`;

const getCustomerMeta = (customer) =>
  [customer?.email, customer?.phone].filter(Boolean).join(" · ") || `ID ${customer?.id ?? "-"}`;

const STORE_MODE_DRAFT_VERSION = 1;
const STORE_MODE_DRAFT_PREFIX = "reebs-store-mode-draft";
const STORE_MODE_DRAFT_TYPE = "pos-cart";

const sanitizeDraftString = (value, max = 240) =>
  typeof value === "string" ? value.slice(0, max) : "";

const sanitizeDraftOrderItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const productId = Number(item?.productId);
      const variantId = Number(item?.variantId);
      const quantity = Math.max(1, Math.round(Number(item?.quantity) || 0));
      const unitPrice = Number(item?.unitPrice);
      const stock = Number(item?.stock);
      if (!Number.isFinite(productId) || productId <= 0) return null;
      return {
        lineKey: sanitizeDraftString(
          item?.lineKey || getProductLineKey(productId, Number.isFinite(variantId) && variantId > 0 ? variantId : ""),
          80
        ),
        productId,
        variantId: Number.isFinite(variantId) && variantId > 0 ? variantId : null,
        productName: sanitizeDraftString(item?.productName || "Untitled", 160) || "Untitled",
        variantLabel: sanitizeDraftString(item?.variantLabel || "", 220),
        name: sanitizeDraftString(item?.name || "Untitled", 160) || "Untitled",
        quantity,
        unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : quantity,
        currency: sanitizeDraftString(item?.currency || "GHS", 8) || "GHS",
      };
    })
    .filter(Boolean);
};

const sanitizeDraftCustomer = (value) => {
  if (!value || typeof value !== "object") return null;
  const id = Number(value.id);
  const customer = {
    id: Number.isFinite(id) && id > 0 ? id : null,
    name: sanitizeDraftString(value.name, 160),
    email: sanitizeDraftString(value.email, 160),
    phone: sanitizeDraftString(value.phone, 40),
  };
  return customer.id || customer.name || customer.email || customer.phone ? customer : null;
};

const getStoreModeDraftKey = (user) => {
  const organizationId = Number(user?.organizationId);
  const userId = Number(user?.id);
  if (!Number.isFinite(organizationId) || organizationId <= 0) return "";
  if (!Number.isFinite(userId) || userId <= 0) return "";
  return `${STORE_MODE_DRAFT_PREFIX}:${organizationId}:${userId}`;
};

const readStoreModeDraft = (key) => {
  const draft = readLocalDraft(key, { version: STORE_MODE_DRAFT_VERSION });
  if (draft?.data) return draft;

  // TODO(offline-draft-migration): remove this sessionStorage fallback after the local draft rollout is stable.
  const sessionDraft = readLocalDraft(key, {
    storage: "sessionStorage",
    version: STORE_MODE_DRAFT_VERSION,
  });
  return sessionDraft?.data ? sessionDraft : null;
};

const writeStoreModeDraft = (key, data, metadata = {}) => {
  const envelope = writeLocalDraft(key, data, {
    version: STORE_MODE_DRAFT_VERSION,
    metadata: {
      sourceApp: "reebs-portal",
      draftType: STORE_MODE_DRAFT_TYPE,
      ...metadata,
    },
  });
  return envelope;
};

const clearStoreModeDraft = (key) => {
  clearLocalDraft(key);
  clearLocalDraft(key, { storage: "sessionStorage" });
};

export {
  EMAIL_PATTERN,
  LOW_STOCK_THRESHOLD,
  PAYMENT_OPTIONS,
  DISCOUNT_OPTIONS,
  clearStoreModeDraft,
  formatMoney,
  applyInventoryLineQuantityDelta,
  buildProductSearchText,
  buildVariantOptionLabel,
  findVariantById,
  getAvailableQuantity,
  getActiveItemVariants,
  getCategory,
  getCustomerLabel,
  getCustomerMeta,
  getQuantity,
  getStoreModeDraftKey,
  getProductLineKey,
  getUnitPrice,
  getVariantAvailableQty,
  getVariantUnitPrice,
  formatVariantLabel,
  isSaleableProduct,
  isVariantParentItem,
  normalizePhoneDigits,
  normalizeText,
  parseReceiptContact,
  readStoreModeDraft,
  sanitizeDraftCustomer,
  sanitizeDraftOrderItems,
  sanitizeDraftString,
  sortCustomersByName,
  todayValue,
  writeStoreModeDraft,
};
