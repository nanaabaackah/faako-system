import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DateField, SelectField } from "@faako/ui";
import "./AdminInvoicing.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowLeft,
  faBoxArchive,
  faChevronLeft,
  faChevronRight,
  faEnvelope,
  faFileInvoice,
  faFilePdf,
  faFloppyDisk,
  faFolderOpen,
  faPlus,
  faPrint,
  faReceipt,
  faRotateRight,
  faXmark,
} from "/src/icons/iconSet";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import SearchField from "../../components/SearchField/SearchField";
import InvoiceDocumentListSection from "./components/InvoiceDocumentListSection";
import { fetchInventoryWithCache } from "../../utils/inventoryCache";
import {
  fetchBookingInvoiceDetails,
  fetchInvoiceDocumentById,
  fetchOrderInvoiceDetails,
} from "../../utils/invoiceDocumentCache";
import {
  DEFAULT_SERVICE_DEPOSIT_DUE_DAYS,
  DEFAULT_SERVICE_PAYMENT_NOTE,
  DEFAULT_SERVICE_PAYMENT_TERMS,
} from "../../../shared/paymentCopy.js";

const COMPANY = {
  name: "REEBS Party Themes",
  location: "Sakumono Broadway, Tema, Ghana",
  phone: "+233 24 478 1819",
  email: "info@reebspartythemes.com",
  logo: "/imgs/brand/reebs_logo.png",
};

const defaultConfig = {
  currency: "GHS",
  taxRate: "0",
  storeName: COMPANY.name,
  storeEmail: COMPANY.email,
  storePhone: COMPANY.phone,
  storeAddress: COMPANY.location,
};

const DOCUMENT_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All documents" },
  { value: "receipt", label: "Receipts" },
  { value: "invoice", label: "Invoices" },
];

const PAYMENT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

const INVOICE_DEPOSIT_RATE = 0.7;

const INVOICE_DUE_DATE_OPTIONS = [
  { value: "immediately", label: "Immediately" },
  { value: "twenty_four_hours", label: "24hrs" },
  { value: "forty_eight_hours", label: "48hrs" },
  { value: "seventy_two_hours", label: "72hrs" },
  { value: "custom", label: "Custom" },
];

const RECEIPT_DUE_DATE_OPTIONS = [
  { value: "immediately", label: "Immediately" },
  { value: "custom", label: "Custom" },
  { value: "none", label: "No due date" },
];

const MANUAL_SOURCE_LABEL = "Invoicing";
const MANUAL_LINKED_LABEL = "Built here";
const MANUAL_LINKED_NOTE = "Built from template";
const DOCUMENT_QUERY_PARAM = "document";
const DEFAULT_LINE_ITEM_UNIT = "Per item";
const INVOICE_DRAFT_STORAGE_PREFIX = "reebs_invoice_draft_";
const INVENTORY_MANAGED_SOURCE_TYPES = new Set(["manual", "bookings"]);
const SHOP_POLICY_TERMS =
  "All shop items are final sale. No returns or exchanges apply unless there are extreme circumstances approved by management.";
const SHOP_POLICY_NOTE = "Shop policy: all shop items are final sale.";
const BOOKING_POLICY_TERMS = DEFAULT_SERVICE_PAYMENT_TERMS;
const BOOKING_POLICY_NOTE = DEFAULT_SERVICE_PAYMENT_NOTE;
const MIXED_POLICY_TERMS = `${SHOP_POLICY_TERMS}\n\n${DEFAULT_SERVICE_PAYMENT_TERMS}`;
const MIXED_POLICY_NOTE = `Mixed policy: shop items are final sale. ${DEFAULT_SERVICE_PAYMENT_NOTE}`;

const loadConfig = () => {
  try {
    const stored = localStorage.getItem("reebs_erp_config");
    if (!stored) return defaultConfig;
    const parsed = JSON.parse(stored);
    return { ...defaultConfig, ...parsed };
  } catch {
    return defaultConfig;
  }
};

const buildInvoiceDraftStorageKey = (entryKey) => `${INVOICE_DRAFT_STORAGE_PREFIX}${entryKey}`;

const readInvoiceDraft = (entryKey) => {
  if (!entryKey) return null;
  try {
    const raw = window.sessionStorage.getItem(buildInvoiceDraftStorageKey(entryKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const writeInvoiceDraft = (entryKey, document) => {
  if (!entryKey || !document) return;
  try {
    window.sessionStorage.setItem(buildInvoiceDraftStorageKey(entryKey), JSON.stringify(document));
  } catch {
    // Ignore storage quota issues; autosave still persists to the server.
  }
};

const formatCurrency = (amount, currency = "GHS") => {
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${currency} ${(Number(amount) || 0).toFixed(2)}`;
  }
};

const formatPdfCurrency = (amount, currency = "GHS") => {
  const value = Number(amount || 0);
  try {
    const formatted = new Intl.NumberFormat("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return `${currency} ${formatted}`;
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const formatShortDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const normalizeDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const formatDateStamp = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10).replace(/-/g, "");
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const defaultDueDateOptionForType = (documentType) =>
  documentType === "invoice" ? "forty_eight_hours" : "none";

const getDueDateOptionsForType = (documentType) =>
  documentType === "invoice" ? INVOICE_DUE_DATE_OPTIONS : RECEIPT_DUE_DATE_OPTIONS;

const normalizeCustomerName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeSearchText = (value) =>
  normalizeCustomerName(
    String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
  );

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeLineQuantity = (value, fallback = 1) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, parsed);
};

const parseTaxRate = (value) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
};

const addDaysToDate = (value, days) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const subtractDaysFromDate = (value, days) => addDaysToDate(value, -Math.abs(days));

const resolveDueDateReference = (document) => {
  const eventDate = normalizeDateInput(document?.event?.eventDate);
  if (eventDate) {
    return { date: eventDate, mode: "before_event" };
  }
  const issueDate = normalizeDateInput(document?.issueDate);
  return { date: issueDate, mode: "after_issue" };
};

const computeDueDate = (document, dueDateOption) => {
  const option = String(dueDateOption || "none");
  const { date: referenceDate, mode } = resolveDueDateReference(document);
  if (option === "custom") return normalizeDateInput(document?.dueDate);
  if (!referenceDate || option === "none") return "";
  if (option === "immediately") return referenceDate;
  if (option === "twenty_four_hours") {
    return mode === "before_event" ? subtractDaysFromDate(referenceDate, 1) : addDaysToDate(referenceDate, 1);
  }
  if (option === "forty_eight_hours" || option === "service_deposit") {
    return mode === "before_event"
      ? subtractDaysFromDate(referenceDate, DEFAULT_SERVICE_DEPOSIT_DUE_DAYS)
      : addDaysToDate(referenceDate, DEFAULT_SERVICE_DEPOSIT_DUE_DAYS);
  }
  if (option === "seventy_two_hours") {
    return mode === "before_event" ? subtractDaysFromDate(referenceDate, 3) : addDaysToDate(referenceDate, 3);
  }
  if (option === "two_weeks") {
    return mode === "before_event" ? subtractDaysFromDate(referenceDate, 14) : addDaysToDate(referenceDate, 14);
  }
  if (option === "thirty_days") {
    return mode === "before_event" ? subtractDaysFromDate(referenceDate, 30) : addDaysToDate(referenceDate, 30);
  }
  return "";
};

const inferDueDateOption = (document, dueDate) => {
  const normalizedDueDate = normalizeDateInput(dueDate);
  if (!normalizedDueDate) return "none";
  if (normalizedDueDate === computeDueDate(document, "immediately")) return "immediately";
  if (normalizedDueDate === computeDueDate(document, "twenty_four_hours")) return "twenty_four_hours";
  if (normalizedDueDate === computeDueDate(document, "forty_eight_hours")) return "forty_eight_hours";
  if (normalizedDueDate === computeDueDate(document, "service_deposit")) return "forty_eight_hours";
  if (normalizedDueDate === computeDueDate(document, "seventy_two_hours")) return "seventy_two_hours";
  if (normalizedDueDate === computeDueDate(document, "two_weeks")) return "custom";
  if (normalizedDueDate === computeDueDate(document, "thirty_days")) return "custom";
  return "custom";
};

const getInvoiceDueDateLabel = (document) =>
  document?.documentType === "invoice" ? "Deposit due" : "Due date";

const isInvoiceFullPaymentDue = (document) => {
  if (document?.documentType !== "invoice") return false;
  if (String(document?.paymentStatus || "").toLowerCase() === "paid") return false;
  const dueDate = normalizeDateInput(document?.dueDate);
  return Boolean(dueDate) && dueDate < todayValue();
};

const getInvoiceDueDateSummaryLabel = (document) =>
  document?.documentType === "invoice" && isInvoiceFullPaymentDue(document) ? "Payment due" : "Deposit due";

const getInvoiceDepositLabel = (document) =>
  isInvoiceFullPaymentDue(document) ? "Amount due (100%)" : "Deposit due (70%)";

const getInvoiceBalanceLabel = () => "Remaining balance";

const syncDocumentLifecycle = (document) => {
  const paymentStatus = String(document?.paymentStatus || "draft").toLowerCase();
  const invoiceNumber = getDocumentNumberValue(document?.invoiceNumber);
  if (paymentStatus !== "draft" && !invoiceNumber) {
    return {
      ...document,
      invoiceNumber: buildDocumentNumber(document?.documentType),
    };
  }
  return {
    ...document,
    invoiceNumber,
  };
};

const syncDueDateFlow = (document) => {
  const dueDateOption =
    document?.dueDateOption || defaultDueDateOptionForType(document?.documentType);
  if (dueDateOption === "custom") {
    return {
      ...document,
      dueDateOption,
      dueDate: normalizeDateInput(document?.dueDate),
    };
  }
  return {
    ...document,
    dueDateOption,
    dueDate: computeDueDate(document, dueDateOption),
  };
};

const loadImageData = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load logo");
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

let companyLogoDataPromise = null;

const getCompanyLogoData = async () => {
  if (!companyLogoDataPromise) {
    companyLogoDataPromise = loadImageData(COMPANY.logo).catch((error) => {
      companyLogoDataPromise = null;
      throw error;
    });
  }
  return companyLogoDataPromise;
};

const readResponseError = async (response, fallbackMessage) => {
  try {
    const body = await response.json();
    return body?.error || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
};

const buildDocumentNumber = (documentType) => {
  const prefix = documentType === "receipt" ? "REC" : "INV";
  return `${prefix}-${formatDateStamp()}-${String(Date.now()).slice(-5)}`;
};

const getDocumentKindLabel = (documentType) => (documentType === "receipt" ? "Receipt" : "Invoice");

const getDocumentNumberValue = (invoiceNumber) => String(invoiceNumber || "").trim();

const getDocumentDisplayHeading = (document) => {
  const invoiceNumber = getDocumentNumberValue(document?.invoiceNumber);
  if (!invoiceNumber) return "Draft";
  const label = document?.docLabel || getDocumentKindLabel(document?.documentType);
  return `${label} #${invoiceNumber}`;
};

const getDocumentTableReference = (document) => getDocumentNumberValue(document?.invoiceNumber) || "Draft";

const getDocumentArchiveLabel = (document) => {
  const invoiceNumber = getDocumentNumberValue(document?.invoiceNumber);
  if (!invoiceNumber) return "Draft";
  const label = document?.docLabel || getDocumentKindLabel(document?.documentType);
  return `${label} ${invoiceNumber}`;
};

const getDocumentFileLabel = (document) => {
  const prefix = document?.documentType === "receipt" ? "receipt" : "invoice";
  return `${prefix}-${getDocumentNumberValue(document?.invoiceNumber) || "draft"}`;
};

const classifyInvoiceProductPolicy = (product) => {
  const sku = String(product?.sku || "").trim().toUpperCase();
  const source = String(product?.sourceCategoryCode || product?.sourcecategorycode || "")
    .trim()
    .toUpperCase();
  const name = String(product?.name || "").trim().toLowerCase();
  const isPump = sku.startsWith("PUM") || name.includes("motor pump");
  if ((source === "RENTAL" || sku.startsWith("RENT")) && !isPump) return "booking";
  return "shop";
};

const resolveDocumentPolicyScope = (document, productById = new Map()) => {
  const sourceType = String(document?.sourceType || "").trim().toLowerCase();
  if (sourceType === "orders") return "shop";
  if (sourceType === "bookings") return "booking";

  const scopes = new Set(
    normalizeLineItems(document?.lineItems)
      .filter((item) => !isHeadingLineItem(item) && !isNoteLineItem(item))
      .map((item) => productById.get(Number(item.productId)))
      .filter(Boolean)
      .map(classifyInvoiceProductPolicy)
  );

  if (scopes.size > 1) return "mixed";
  if (scopes.has("booking")) return "booking";
  if (scopes.has("shop")) return "shop";
  return document?.documentType === "receipt" ? "shop" : "booking";
};

const getPolicyCopyForScope = (scope) => {
  if (scope === "mixed") {
    return {
      terms: MIXED_POLICY_TERMS,
      notes: MIXED_POLICY_NOTE,
    };
  }
  if (scope === "booking") {
    return {
      terms: BOOKING_POLICY_TERMS,
      notes: BOOKING_POLICY_NOTE,
    };
  }
  return {
    terms: SHOP_POLICY_TERMS,
    notes: SHOP_POLICY_NOTE,
  };
};

const defaultTermsForType = (documentType) =>
  getPolicyCopyForScope(documentType === "receipt" ? "shop" : "booking").terms;

const defaultNotesForType = (documentType) =>
  getPolicyCopyForScope(documentType === "receipt" ? "shop" : "booking").notes;

const defaultPolicyCopyForDocument = (document, productById = new Map()) =>
  getPolicyCopyForScope(resolveDocumentPolicyScope(document, productById));

const MANAGED_POLICY_TEXTS = new Set([
  "",
  SHOP_POLICY_TERMS,
  SHOP_POLICY_NOTE,
  BOOKING_POLICY_TERMS,
  BOOKING_POLICY_NOTE,
  MIXED_POLICY_TERMS,
  MIXED_POLICY_NOTE,
  "Shop items can only be returned or exchanged with the original receipt and manager approval.",
  "Shop policy: returns need the original receipt.",
  "Returns or exchanges require the original receipt.",
  "Balance is due before delivery or pickup unless noted.",
  "Thank you for your purchase.",
  "Thank you for your booking.",
]);

const isManagedPolicyText = (value) => MANAGED_POLICY_TEXTS.has(String(value || ""));

const syncManagedPolicyCopy = (currentDocument, nextDocument, productById = new Map()) => {
  const policyCopy = defaultPolicyCopyForDocument(nextDocument, productById);
  const next = { ...nextDocument };

  if (currentDocument) {
    if (next.notes === currentDocument.notes && isManagedPolicyText(currentDocument.notes)) {
      next.notes = policyCopy.notes;
    }
    if (next.terms === currentDocument.terms && isManagedPolicyText(currentDocument.terms)) {
      next.terms = policyCopy.terms;
    }
    return next;
  }

  if (!next.notes || isManagedPolicyText(next.notes)) {
    next.notes = policyCopy.notes;
  }
  if (!next.terms || isManagedPolicyText(next.terms)) {
    next.terms = policyCopy.terms;
  }
  return next;
};

const normalizeLineRowType = (value) => {
  const normalized = String(value || "item").toLowerCase();
  if (normalized === "heading") return "heading";
  if (normalized === "note") return "note";
  return "item";
};

const isHeadingLineItem = (item) => normalizeLineRowType(item?.rowType) === "heading";
const isNoteLineItem = (item) => normalizeLineRowType(item?.rowType) === "note";

const normalizeLineUnitLabel = (value) => {
  const normalized = String(value || "").trim();
  return normalized || DEFAULT_LINE_ITEM_UNIT;
};

const isPerHeadRateLabel = (value) => /\bhead\b/i.test(String(value || ""));

const resolveProductUnitLabel = (product) => normalizeLineUnitLabel(product?.rate || product?.unitLabel);

const isRentalProduct = (product) =>
  String(product?.sourceCategoryCode || product?.sourcecategorycode || "")
    .trim()
    .toUpperCase() === "RENTAL";

const shouldManageInvoiceInventory = (sourceType) =>
  INVENTORY_MANAGED_SOURCE_TYPES.has(String(sourceType || "").trim().toLowerCase());

const hasSourceManagedInventory = (document) => String(document?.sourceType || "").trim().toLowerCase() === "orders";

const isDocumentInventoryCommitted = (document) =>
  shouldManageInvoiceInventory(document?.sourceType) && Boolean(document?.stockCommittedAt);

const shouldReuseCommittedInventory = (document) =>
  isDocumentInventoryCommitted(document) || hasSourceManagedInventory(document);

const getProductStockQuantity = (product) =>
  Math.max(0, normalizeLineQuantity(product?.quantity ?? product?.stock, 0));

const buildProductSearchBlob = (product) =>
  normalizeSearchText(
    [
      product?.name,
      product?.sku,
      product?.barcode,
      product?.description,
      product?.specificCategory,
      product?.sourceCategoryCode,
    ]
      .filter(Boolean)
      .join(" ")
  );

const matchesProductSearch = (product, query) => {
  const tokens = normalizeSearchText(query)
    .split(" ")
    .filter(Boolean);
  if (!tokens.length) return true;
  const blob = buildProductSearchBlob(product);
  return tokens.every((token) => blob.includes(token));
};

const extractInventoryItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
};

const createLineItem = (overrides = {}) => ({
  ...(() => {
    const rowType = normalizeLineRowType(overrides.rowType);
    const id = overrides.id || `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (rowType === "heading") {
      return {
        id,
        rowType: "heading",
        productId: null,
        name: overrides.name || "",
        unitLabel: "",
        quantity: 0,
        unitPrice: 0,
        total: 0,
      };
    }
    if (rowType === "note") {
      return {
        id,
        rowType: "note",
        productId: null,
        name: overrides.name || "",
        unitLabel: "",
        quantity: 0,
        unitPrice: 0,
        total: 0,
      };
    }
    return {
      id,
      rowType: "item",
      productId: Number.isFinite(Number(overrides.productId)) ? Number(overrides.productId) : null,
      name: overrides.name || "",
      unitLabel: normalizeLineUnitLabel(overrides.unitLabel),
      quantity: normalizeLineQuantity(overrides.quantity, 1),
      unitPrice: Math.max(0, toNumber(overrides.unitPrice, 0)),
      total: 0,
    };
  })(),
});

const createHeadingLine = (overrides = {}) => createLineItem({ ...overrides, rowType: "heading" });
const createNoteLine = (overrides = {}) => createLineItem({ ...overrides, rowType: "note" });

const normalizeLineItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => createLineItem(item))
    .map((item) => ({
      ...item,
      total: isHeadingLineItem(item) || isNoteLineItem(item) ? 0 : Number((item.quantity * item.unitPrice).toFixed(2)),
    }));
};

const ensureEditableLineItems = (items) => {
  const normalized = normalizeLineItems(items);
  return normalized.length ? normalized : [createLineItem()];
};

const buildDocumentSourceLineItems = (items, mapItem) => {
  if (!Array.isArray(items)) return [];

  const nextItems = [];
  items.forEach((item, index) => {
    const mappedItem = mapItem(item, index);
    if (!mappedItem) return;

    const baseLine = createLineItem(mappedItem);
    nextItems.push(baseLine);

    if (isHeadingLineItem(baseLine) || isNoteLineItem(baseLine)) return;

    const attendantsPerUnit = Math.max(0, toNumber(item?.attendantsNeeded, 0));
    if (attendantsPerUnit <= 0) return;

    const totalAttendants = attendantsPerUnit * Math.max(1, normalizeLineQuantity(item?.quantity, 1));
    nextItems.push(
      createNoteLine({
        id: `${baseLine.id}-attendants`,
        name: `Attendants needed: ${totalAttendants}`,
      })
    );
  });

  return normalizeLineItems(nextItems);
};

const buildLineItemProductQuantityMap = (items) =>
  normalizeLineItems(items).reduce((map, item) => {
    if (isHeadingLineItem(item) || isNoteLineItem(item) || !Number(item.productId)) return map;
    const productId = Number(item.productId);
    const quantity = isPerHeadRateLabel(item.unitLabel)
      ? normalizeLineQuantity(item.quantity, 0) > 0
        ? 1
        : 0
      : normalizeLineQuantity(item.quantity, 0);
    if (quantity <= 0) return map;
    map.set(productId, (map.get(productId) || 0) + quantity);
    return map;
  }, new Map());

const resolveProductRemainingStock = (document, item, product) => {
  const productId = Number(product?.id ?? item?.productId);
  if (!Number.isFinite(productId) || productId <= 0) return null;
  const documentQuantities = buildLineItemProductQuantityMap(document?.lineItems);
  const currentProductQuantity = documentQuantities.get(productId) || 0;
  const currentLineQuantity =
    Number(item?.productId) === productId
      ? isPerHeadRateLabel(item?.unitLabel || resolveProductUnitLabel(product))
        ? normalizeLineQuantity(item?.quantity, 0) > 0
          ? 1
          : 0
        : normalizeLineQuantity(item?.quantity, 0)
      : 0;
  const siblingQuantity = Math.max(0, currentProductQuantity - currentLineQuantity);
  const reusableCommittedQuantity = shouldReuseCommittedInventory(document) ? currentProductQuantity : 0;
  return Math.max(0, getProductStockQuantity(product) + reusableCommittedQuantity - siblingQuantity);
};

const resolveLineItemMaxQuantity = (document, item, productById) => {
  const productId = Number(item?.productId);
  if (!Number.isFinite(productId) || productId <= 0) return null;
  const product = productById.get(productId);
  if (!product) return null;
  if (isPerHeadRateLabel(item?.unitLabel || resolveProductUnitLabel(product))) {
    return null;
  }
  return resolveProductRemainingStock(document, item, product);
};

const clearLegacyDraftLineItemPlaceholders = (items, sourceType) => {
  if (sourceType !== "manual") return items;
  return items.map((item) => {
    if (isHeadingLineItem(item) || isNoteLineItem(item)) return item;
    const isLegacyBlankRow =
      !item.productId &&
      normalizeSearchText(item.name) === "item" &&
      Number(item.quantity || 0) === 1 &&
      Number(item.unitPrice || 0) === 0;
    return isLegacyBlankRow ? { ...item, name: "" } : item;
  });
};

const summarizeLineItems = (items) =>
  normalizeLineItems(items).reduce(
    (accumulator, item) => {
      accumulator.rows += 1;
      if (isHeadingLineItem(item)) {
        accumulator.headingCount += 1;
        return accumulator;
      }
      if (isNoteLineItem(item)) return accumulator;
      accumulator.count += 1;
      accumulator.quantity += Number(item.quantity) || 0;
      accumulator.priceTotal += Number(item.unitPrice) || 0;
      accumulator.total += Number(item.total) || 0;
      return accumulator;
    },
    { rows: 0, count: 0, headingCount: 0, quantity: 0, priceTotal: 0, total: 0 }
  );

const normalizeExpenses = (expenses) => {
  if (!Array.isArray(expenses)) return [];
  return expenses.map((expense, index) => ({
    id: expense?.id || `expense-${index + 1}`,
    category: String(expense?.category || "Expense"),
    description: String(expense?.description || ""),
    date: normalizeDateInput(expense?.date),
    amount: Math.max(0, toNumber(expense?.amount, 0)),
  }));
};

const normalizeExpenseList = (payload) => {
  let expenses = payload?.expenses || [];
  if (typeof expenses === "string") {
    try {
      expenses = JSON.parse(expenses);
    } catch {
      expenses = [];
    }
  }
  const normalized = normalizeExpenses(expenses);
  const total = normalized.reduce((sum, expense) => sum + expense.amount, 0);
  return { expenses: normalized, total };
};

const parseStoredArrayField = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeAdditionalItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => {
    const quantity = Math.max(0, normalizeLineQuantity(item?.quantity, 1));
    const unitPrice = Math.max(0, toNumber(item?.unitPrice, 0));
    return {
      id: item?.id || `extra-${index + 1}`,
      description: String(item?.description || ""),
      quantity,
      unitLabel: normalizeLineUnitLabel(item?.unitLabel),
      unitPrice,
      total: Number((quantity * unitPrice).toFixed(2)),
    };
  });
};

const createAdditionalItem = (overrides = {}) => {
  const id = overrides.id || `extra-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const quantity = Math.max(0, normalizeLineQuantity(overrides.quantity, 1));
  const unitPrice = Math.max(0, toNumber(overrides.unitPrice, 0));
  return {
    id,
    description: String(overrides.description || ""),
    quantity,
    unitLabel: normalizeLineUnitLabel(overrides.unitLabel),
    unitPrice,
    total: Number((quantity * unitPrice).toFixed(2)),
  };
};

const LINKED_EXPENSE_PREFIX = "linked-expense-";

const createAdditionalItemsFromExpenses = (expenses = []) =>
  normalizeExpenses(expenses).map((expense, index) => {
    const expenseId = expense.id || index + 1;
    const category = String(expense.category || "").trim();
    const description = String(expense.description || "").trim();
    return createAdditionalItem({
      id: `${LINKED_EXPENSE_PREFIX}${expenseId}`,
      description: [category && category !== "Expense" ? category : "", description]
        .filter(Boolean)
        .join(": ") || "Booking expense",
      quantity: 1,
      unitLabel: "Expense",
      unitPrice: expense.amount,
    });
  });

const mergeLinkedAdditionalItems = (savedItems = [], baseItems = []) => {
  const normalizedSaved = normalizeAdditionalItems(savedItems);
  const normalizedBase = normalizeAdditionalItems(baseItems);
  if (!normalizedSaved.length) return normalizedBase;

  const savedIds = new Set(normalizedSaved.map((item) => String(item.id)));
  const missingLinkedItems = normalizedBase.filter((item) => {
    const itemId = String(item.id || "");
    return itemId.startsWith(LINKED_EXPENSE_PREFIX) && !savedIds.has(itemId);
  });

  return [...normalizedSaved, ...missingLinkedItems];
};

const mergeLinkedExpenses = (savedExpenses = [], baseExpenses = []) => {
  const normalizedSaved = normalizeExpenses(savedExpenses);
  const normalizedBase = normalizeExpenses(baseExpenses);
  if (!normalizedSaved.length) return normalizedBase;

  const savedIds = new Set(normalizedSaved.map((expense) => String(expense.id)));
  const missingExpenses = normalizedBase.filter((expense) => !savedIds.has(String(expense.id)));
  return [...normalizedSaved, ...missingExpenses];
};

const buildEntryKey = (sourceType, sourceId, id = null) =>
  sourceType === "manual" ? `manual-${id}` : `${sourceType}-${sourceId}`;

const parseEntryKey = (entryKey) => {
  const raw = String(entryKey || "").trim();
  if (!raw) return null;
  if (raw.startsWith("manual-")) {
    return {
      sourceType: "manual",
      sourceId: null,
      id: Number(raw.slice("manual-".length)) || null,
    };
  }
  if (raw.startsWith("orders-")) {
    return {
      sourceType: "orders",
      sourceId: Number(raw.slice("orders-".length)) || null,
      id: null,
    };
  }
  if (raw.startsWith("bookings-")) {
    return {
      sourceType: "bookings",
      sourceId: Number(raw.slice("bookings-".length)) || null,
      id: null,
    };
  }
  return null;
};

const buildSourceLabel = (sourceType, sourceId) => {
  if (sourceType === "manual") return MANUAL_SOURCE_LABEL;
  if (sourceType === "bookings") return `Booking #${sourceId}`;
  return `Order #${sourceId}`;
};

const buildEmptyDocument = (documentType, taxRate = 0) =>
  syncDueDateFlow({
    id: null,
    sourceType: "manual",
    sourceId: null,
    customerId: null,
    documentType,
    title: "",
    invoiceNumber: "",
    issueDate: todayValue(),
    dueDate: "",
    dueDateOption: defaultDueDateOptionForType(documentType),
    paymentStatus: "draft",
    depositAmount: 0,
    discountAmount: 0,
    customer: {
      name: "",
      email: "",
      phone: "",
    },
    event: {
      eventDate: "",
      startTime: "",
      endTime: "",
      venueAddress: "",
    },
    lineItems: [createLineItem(), createLineItem()],
    expenses: [],
    additionalItems: [],
    notes: defaultNotesForType(documentType),
    terms: defaultTermsForType(documentType),
    taxRate,
    docLabel: documentType === "receipt" ? "Receipt" : "Invoice",
    sourceLabel: MANUAL_SOURCE_LABEL,
    linkedLabel: MANUAL_LINKED_LABEL,
    stockCommittedAt: null,
    sentAt: null,
    sentToEmail: "",
    createdAt: null,
    updatedAt: null,
  });

const normalizeStoredDocument = (record) => {
  const documentType = record?.documentType === "receipt" ? "receipt" : "invoice";
  const issueDate = normalizeDateInput(record?.issueDate) || todayValue();
  const dueDate = normalizeDateInput(record?.dueDate);
  const event = {
    eventDate: normalizeDateInput(record?.eventDate),
    startTime: String(record?.startTime || ""),
    endTime: String(record?.endTime || ""),
    venueAddress: String(record?.venueAddress || ""),
  };
  const dueDateReference = {
    documentType,
    issueDate,
    event,
  };
  return {
    id: Number(record?.id) || null,
    sourceType: record?.sourceType || "manual",
    sourceId: Number(record?.sourceId) || null,
    customerId: Number(record?.customerId) || null,
    documentType,
    title: String(record?.title || ""),
    invoiceNumber: getDocumentNumberValue(record?.invoiceNumber),
    issueDate,
    dueDate,
    dueDateOption: inferDueDateOption(dueDateReference, dueDate),
    paymentStatus: String(record?.paymentStatus || "draft").toLowerCase(),
    depositAmount: Math.max(0, toNumber(record?.depositAmount, 0)),
    discountAmount: Math.max(0, toNumber(record?.discountAmount, 0)),

    customer: {
      name: String(record?.customerName || ""),
      email: String(record?.customerEmail || ""),
      phone: String(record?.customerPhone || ""),
    },
    event,
    lineItems: clearLegacyDraftLineItemPlaceholders(
      ensureEditableLineItems(parseStoredArrayField(record?.lineItems)),
      record?.sourceType || "manual"
    ),
    expenses: normalizeExpenses(parseStoredArrayField(record?.expenses)),
    additionalItems: normalizeAdditionalItems(parseStoredArrayField(record?.additionalItems)),
    notes: String(record?.notes || ""),
    terms: String(record?.terms || ""),
    taxRate: parseTaxRate(record?.taxRate),
    docLabel: documentType === "receipt" ? "Receipt" : "Invoice",
    sourceLabel: buildSourceLabel(record?.sourceType, record?.sourceId, record?.title),
    linkedLabel:
      record?.sourceType === "manual"
        ? MANUAL_LINKED_LABEL
        : buildSourceLabel(record?.sourceType, record?.sourceId),
    stockCommittedAt: record?.stockCommittedAt || null,
    sentAt: record?.sentAt || null,
    sentToEmail: String(record?.sentToEmail || ""),
    archivedAt: record?.archivedAt || null,
    createdAt: record?.createdAt || null,
    updatedAt: record?.updatedAt || null,
  };
};

const normalizeOrderDocument = (payload, fallbackItems = [], defaultTaxRate = 0) => {
  let items = Array.isArray(payload?.items) ? payload.items : [];
  let usingFallback = false;
  if (!items.length && Array.isArray(fallbackItems) && fallbackItems.length) {
    items = fallbackItems;
    usingFallback = true;
  }
  const expenseInfo = normalizeExpenseList(payload);
  return {
    id: null,
    sourceType: "orders",
    sourceId: payload?.id || null,
    customerId: Number(payload?.customerId || payload?.customer?.id) || null,
    documentType: "receipt",
    title: payload?.orderNumber ? `Receipt ${payload.orderNumber}` : "",
    invoiceNumber: getDocumentNumberValue(payload?.invoiceNumber),
    issueDate: normalizeDateInput(payload?.date || payload?.orderDate || payload?.createdAt) || todayValue(),
    dueDate: "",
    dueDateOption: defaultDueDateOptionForType("receipt"),
    paymentStatus: "draft",
    depositAmount: 0,
    discountAmount: 0,

    customer: {
      name: payload?.customer?.name || payload?.customerName || "",
      email: payload?.customer?.email || "",
      phone: payload?.customer?.phone || "",
    },
    event: {
      eventDate: "",
      startTime: "",
      endTime: "",
      venueAddress: "",
    },
    lineItems: ensureEditableLineItems(buildDocumentSourceLineItems(items, (item, index) => {
        const quantity = normalizeLineQuantity(item.quantity, 1);
        const unitPriceRaw = toNumber(item.unitPriceCents ?? item.unit_price ?? item.unitPrice, 0);
        const totalRaw = toNumber(item.totalCents ?? item.total_amount ?? item.total, unitPriceRaw * quantity);
        const isCents =
          usingFallback ||
          item.unitPriceCents != null ||
          item.unit_price != null ||
          item.totalCents != null ||
          item.total_amount != null;
        return {
          id: item.id || `${item.productId || "item"}-${index}`,
          productId: item.productId || null,
          name: item.name || item.Product?.name || "Item",
          unitLabel: resolveProductUnitLabel(item),
          quantity,
          unitPrice: isCents ? unitPriceRaw / 100 : unitPriceRaw,
          total: isCents ? totalRaw / 100 : totalRaw,
        };
      })),
    expenses: expenseInfo.expenses,
    additionalItems: createAdditionalItemsFromExpenses(expenseInfo.expenses),
    notes: defaultNotesForType("receipt"),
    terms: defaultTermsForType("receipt"),
    taxRate: defaultTaxRate,
    docLabel: "Receipt",
    sourceLabel: "Order",
    linkedLabel: payload?.orderNumber ? `Order ${payload.orderNumber}` : `Order #${payload?.id || ""}`,
    stockCommittedAt: null,
    createdAt: payload?.createdAt || payload?.orderDate || null,
    updatedAt: payload?.lastModifiedAt || payload?.updatedAt || null,
  };
};

const normalizeBookingDocument = (payload, fallbackItems = [], defaultTaxRate = 0) => {
  let items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length && Array.isArray(fallbackItems) && fallbackItems.length) {
    items = fallbackItems;
  }
  const subtotal = toNumber(payload?.totalAmount, 0) / 100;
  const expenseInfo = normalizeExpenseList(payload);
  const issueDate = normalizeDateInput(payload?.eventDate) || todayValue();
  const event = {
    eventDate: normalizeDateInput(payload?.eventDate),
    startTime: payload?.startTime || "",
    endTime: payload?.endTime || "",
    venueAddress: payload?.venueAddress || "",
  };
  return {
    id: null,
    sourceType: "bookings",
    sourceId: payload?.id || null,
    customerId: Number(payload?.customerId || payload?.customer?.id) || null,
    documentType: "invoice",
    title: payload?.id ? `Invoice Booking #${payload.id}` : "",
    invoiceNumber: getDocumentNumberValue(payload?.invoiceNumber),
    issueDate,
    dueDate: computeDueDate(
      {
        issueDate,
        event,
      },
      defaultDueDateOptionForType("invoice")
    ),
    dueDateOption: defaultDueDateOptionForType("invoice"),
    paymentStatus: "draft",
    depositAmount: Number((subtotal * 0.7).toFixed(2)),
    discountAmount: 0,

    customer: {
      name: payload?.customerName || "Customer",
      email: payload?.customerEmail || "",
      phone: payload?.customerPhone || "",
    },
    event,
      lineItems: ensureEditableLineItems(buildDocumentSourceLineItems(items, (item, index) => ({
        id: item.id || `${item.productId || "item"}-${index}`,
        productId: item.productId || null,
        name: item.productName || item.name || "Item",
        unitLabel: resolveProductUnitLabel(item),
        quantity: normalizeLineQuantity(item.quantity, 1),
        unitPrice: toNumber(item.price ?? item.unitPrice, 0) / 100,
        total: (toNumber(item.price ?? item.unitPrice, 0) / 100) * normalizeLineQuantity(item.quantity, 1),
      }))),
    expenses: expenseInfo.expenses,
    additionalItems: createAdditionalItemsFromExpenses(expenseInfo.expenses),
    notes: defaultNotesForType("invoice"),
    terms: defaultTermsForType("invoice"),
    taxRate: defaultTaxRate,
    docLabel: "Invoice",
    sourceLabel: "Booking",
    linkedLabel: payload?.id ? `Booking #${payload.id}` : "Booking",
    stockCommittedAt: null,
    createdAt: payload?.createdAt || payload?.eventDate || null,
    updatedAt: payload?.lastModifiedAt || payload?.updatedAt || null,
  };
};

const mergeDocument = (baseDocument, savedDocument) => {
  if (!savedDocument) return baseDocument;
  return {
    ...baseDocument,
    ...savedDocument,
    id: savedDocument.id || null,
    customerId: Number(savedDocument.customerId ?? baseDocument.customerId) || null,
    documentType: savedDocument.documentType || baseDocument.documentType,
    title: savedDocument.title || baseDocument.title,
    invoiceNumber: savedDocument.invoiceNumber || baseDocument.invoiceNumber,
    issueDate: savedDocument.issueDate || baseDocument.issueDate,
    dueDate: savedDocument.dueDate ?? baseDocument.dueDate,
    dueDateOption: savedDocument.dueDateOption || baseDocument.dueDateOption,
    paymentStatus: savedDocument.paymentStatus || baseDocument.paymentStatus,
    depositAmount: toNumber(savedDocument.depositAmount, baseDocument.depositAmount),
    discountAmount: toNumber(savedDocument.discountAmount, baseDocument.discountAmount),
    customer: {
      ...baseDocument.customer,
      ...(savedDocument.customer || {}),
    },
    event: {
      ...baseDocument.event,
      ...(savedDocument.event || {}),
    },
    lineItems: ensureEditableLineItems(savedDocument.lineItems),
    expenses: mergeLinkedExpenses(savedDocument.expenses, baseDocument.expenses),
    additionalItems: mergeLinkedAdditionalItems(savedDocument.additionalItems, baseDocument.additionalItems),
    notes: savedDocument.notes ?? baseDocument.notes,
    terms: savedDocument.terms ?? baseDocument.terms,
    taxRate: parseTaxRate(savedDocument.taxRate ?? baseDocument.taxRate),
    updatedAt: savedDocument.updatedAt || baseDocument.updatedAt,
    createdAt: savedDocument.createdAt || baseDocument.createdAt,
    stockCommittedAt: savedDocument.stockCommittedAt || baseDocument.stockCommittedAt || null,
    sentAt: savedDocument.sentAt || baseDocument.sentAt || null,
    sentToEmail: savedDocument.sentToEmail || baseDocument.sentToEmail || "",
    sourceLabel: baseDocument.sourceLabel,
    linkedLabel: baseDocument.linkedLabel,
    docLabel: savedDocument.documentType === "receipt" ? "Receipt" : savedDocument.documentType === "invoice" ? "Invoice" : baseDocument.docLabel,
  };
};

const clampDocumentLineItemsToStock = (document, productById = new Map()) => {
  const lineItems = normalizeLineItems(document?.lineItems);
  let didClamp = false;
  const nextLineItems = lineItems.map((item) => {
    if (isHeadingLineItem(item) || isNoteLineItem(item) || !item.productId) return item;
    const maxQuantity = resolveLineItemMaxQuantity({ ...document, lineItems }, item, productById);
    if (maxQuantity == null || item.quantity <= maxQuantity) return item;
    didClamp = true;
    return {
      ...item,
      quantity: maxQuantity,
    };
  });

  if (!didClamp) {
    return {
      ...document,
      lineItems,
    };
  }

  return {
    ...document,
    lineItems: nextLineItems,
  };
};

const computeDocumentSummary = (document) => {
  const lineItems = normalizeLineItems(document?.lineItems);
  const expenses = normalizeExpenses(document?.expenses);
  const additionalItems = normalizeAdditionalItems(document?.additionalItems);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const additionalTotal = Number(additionalItems.reduce((sum, item) => sum + item.total, 0).toFixed(2));
  const taxRate = parseTaxRate(document?.taxRate);
  const rawDiscount = Math.max(0, toNumber(document?.discountAmount, 0));
  const taxTotal = Number(((subtotal + additionalTotal) * taxRate).toFixed(2));
  const discountTotal = Math.min(rawDiscount, subtotal + additionalTotal + taxTotal);
  const grandTotal = Math.max(0, Number((subtotal + additionalTotal + taxTotal - discountTotal).toFixed(2)));
  const fullPaymentDue = isInvoiceFullPaymentDue(document);
  const depositAmount =
    document?.documentType === "invoice"
      ? fullPaymentDue
        ? grandTotal
        : Number((grandTotal * INVOICE_DEPOSIT_RATE).toFixed(2))
      : 0;
  const amountPaid = document?.paymentStatus === "paid" ? grandTotal : depositAmount;
  const balanceDue =
    document?.documentType === "invoice" && fullPaymentDue
      ? 0
      : Math.max(0, Number((grandTotal - amountPaid).toFixed(2)));
  const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

  return {
    ...document,
    docLabel: document?.documentType === "receipt" ? "Receipt" : "Invoice",
    depositAmount,
    lineItems,
    expenses,
    additionalItems,
    summary: {
      subtotal,
      additionalTotal,
      taxRate,
      taxTotal,
      grandTotal,
      depositAmount,
      discountTotal,
      amountPaid,
      balanceDue,
      fullPaymentDue,
      expensesTotal,
    },
  };
};

const normalizeSavedDocumentRecord = (record) =>
  computeDocumentSummary(normalizeStoredDocument(record));

const normalizeSavedDocumentListRecord = (record) => {
  const documentType = record?.documentType === "receipt" ? "receipt" : "invoice";
  const issueDate = normalizeDateInput(record?.issueDate) || todayValue();
  const dueDate = normalizeDateInput(record?.dueDate);
  const event = {
    eventDate: normalizeDateInput(record?.eventDate),
    startTime: String(record?.startTime || ""),
    endTime: String(record?.endTime || ""),
    venueAddress: String(record?.venueAddress || ""),
  };

  return {
    id: Number(record?.id) || null,
    sourceType: record?.sourceType || "manual",
    sourceId: Number(record?.sourceId) || null,
    customerId: Number(record?.customerId) || null,
    documentType,
    title: String(record?.title || ""),
    invoiceNumber: getDocumentNumberValue(record?.invoiceNumber),
    issueDate,
    dueDate,
    dueDateOption: inferDueDateOption({ documentType, issueDate, event }, dueDate),
    paymentStatus: String(record?.paymentStatus || "draft").toLowerCase(),
    depositAmount: Math.max(0, toNumber(record?.depositAmount, 0)),
    discountAmount: Math.max(0, toNumber(record?.discountAmount, 0)),
    customer: {
      name: String(record?.customerName || ""),
      email: String(record?.customerEmail || ""),
      phone: String(record?.customerPhone || ""),
    },
    event,
    lineItems: [],
    expenses: [],
    additionalItems: [],
    notes: "",
    terms: "",
    taxRate: parseTaxRate(record?.taxRate),
    docLabel: documentType === "receipt" ? "Receipt" : "Invoice",
    sourceLabel: buildSourceLabel(record?.sourceType, record?.sourceId),
    linkedLabel:
      record?.sourceType === "manual"
        ? MANUAL_LINKED_LABEL
        : buildSourceLabel(record?.sourceType, record?.sourceId),
    stockCommittedAt: record?.stockCommittedAt || null,
    sentAt: record?.sentAt || null,
    sentToEmail: String(record?.sentToEmail || ""),
    archivedAt: record?.archivedAt || null,
    createdAt: record?.createdAt || null,
    updatedAt: record?.updatedAt || null,
    summary: {
      grandTotal: Math.max(0, toNumber(record?.grandTotal, 0)),
    },
  };
};

const buildStoredPayload = (document) => ({
  id: document.id,
  sourceType: document.sourceType,
  sourceId: document.sourceId,
  customerId: document.customerId || null,
  documentType: document.documentType,
  title: getDocumentDisplayHeading(document),
  invoiceNumber: getDocumentNumberValue(document.invoiceNumber),
  issueDate: document.issueDate,
  dueDate: document.dueDate || computeDueDate(document, document.dueDateOption),
  paymentStatus: document.paymentStatus,
  sentAt: document.sentAt || null,
  sentToEmail: document.sentToEmail || "",
  depositAmount: document.documentType === "invoice" ? toNumber(document.depositAmount, 0) : 0,
  discountAmount: document.documentType === "invoice" ? toNumber(document.discountAmount, 0) : 0,
  customerName: document.customer?.name || "",
  customerEmail: document.customer?.email || "",
  customerPhone: document.customer?.phone || "",
  eventDate: document.event?.eventDate || "",
  startTime: document.event?.startTime || "",
  endTime: document.event?.endTime || "",
  venueAddress: document.event?.venueAddress || "",
  lineItems: normalizeLineItems(document.lineItems),
  expenses: normalizeExpenses(document.expenses),
  additionalItems: normalizeAdditionalItems(document.additionalItems),
  notes: document.notes || "",
  terms: document.terms || "",
  taxRate: parseTaxRate(document.taxRate),
});

function DocumentPill({ value }) {
  const normalized = String(value || "draft").toLowerCase();
  const statusClass = normalized === "paid" ? "paid" : normalized === "draft" ? "draft" : "unpaid";
  return <span className={`invoice-pill ${statusClass}`}>{normalized}</span>;
}

function DocumentSentBanner({ sentAt }) {
  if (!sentAt) return null;
  return (
    <div className="invoice-sent-banner" aria-label="Document sent status">
      <strong>Sent</strong>
    </div>
  );
}

function InvoiceCustomerPicker({
  value,
  onChange,
  onClear,
  onFocus,
  onBlur,
  onKeyDown,
  menuOpen,
  options,
  selectedCustomerId,
  onSelectCustomer,
  customerError = "",
}) {
  return (
    <div className="invoice-customer-picker">
      <SearchField
        value={value}
        onChange={onChange}
        onClear={onClear}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="Search customer"
        aria-label="Search customer"
        inputClassName="invoice-customer-picker-input"
      />
      {menuOpen ? (
        options.length ? (
          <div className="invoice-customer-picker-menu" role="listbox" aria-label="Customer directory">
            {options.map((customer) => {
              const isActive = String(customer.id) === String(selectedCustomerId);
              return (
                <button
                  key={customer.id}
                  type="button"
                  className={`invoice-customer-picker-option ${isActive ? "is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelectCustomer(String(customer.id))}
                >
                  <span>{customer.name}</span>
                </button>
              );
            })}
          </div>
        ) : null
      ) : null}
      {customerError ? <p className="invoice-customer-picker-note">{customerError}</p> : null}
    </div>
  );
}

function InvoiceProductPicker({
  value,
  onChange,
  onSelectProduct,
  products,
  document,
  currentItem,
  selectedProductId,
  disabled = false,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedQuery = normalizeSearchText(value);
  const availableProducts = useMemo(
    () =>
      Array.isArray(products)
        ? products.filter((product) => {
            if (getProductStockQuantity(product) <= 0) return false;
            if (!document || !currentItem) return true;
            if (String(product.id) === String(selectedProductId)) return true;
            if (!isRentalProduct(product)) return true;
            return (resolveProductRemainingStock(document, currentItem, product) || 0) > 0;
          })
        : [],
    [currentItem, document, products, selectedProductId]
  );

  const filteredOptions = useMemo(() => {
    if (!availableProducts.length) return [];
    const source = normalizedQuery
      ? availableProducts.filter((product) => matchesProductSearch(product, normalizedQuery))
      : availableProducts;
    return source.slice(0, normalizedQuery ? 12 : 8);
  }, [availableProducts, normalizedQuery]);

  const commitTypedProduct = useCallback(() => {
    const typedValue = String(value || "").trim();
    if (!typedValue) {
      setMenuOpen(false);
      return;
    }
    const lowered = typedValue.toLowerCase();
    const matchedProduct =
      availableProducts.find((product) => {
        const nameMatch = normalizeSearchText(product.name) === normalizeSearchText(typedValue);
        const skuMatch = String(product.sku || "").trim().toLowerCase() === lowered;
        const barcodeMatch = String(product.barcode || "").trim().toLowerCase() === lowered;
        return nameMatch || skuMatch || barcodeMatch;
      }) || null;
    if (matchedProduct) {
      onSelectProduct(matchedProduct);
    }
    setMenuOpen(false);
  }, [availableProducts, onSelectProduct, value]);

  return (
    <div className="invoice-product-picker">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setMenuOpen(true);
        }}
        onFocus={() => {
          if (!disabled) setMenuOpen(true);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setMenuOpen(false);
          }, 120);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitTypedProduct();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setMenuOpen(false);
          }
        }}
        className="invoice-product-picker-input"
        placeholder="Search product, SKU or barcode"
        disabled={disabled}
        aria-label="Search product"
      />
      {menuOpen && !disabled ? (
        filteredOptions.length ? (
          <div className="invoice-product-picker-menu" role="listbox" aria-label="Product directory">
            {filteredOptions.map((product) => {
              const isActive = String(product.id) === String(selectedProductId);
              return (
                <button
                  key={product.id}
                  type="button"
                  className={`invoice-product-picker-option ${isActive ? "is-active" : ""}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelectProduct(product);
                    setMenuOpen(false);
                  }}
                >
                  <span>{product.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="invoice-product-picker-menu invoice-product-picker-menu--empty">
            <span className="invoice-product-picker-empty">
              {availableProducts.length ? "No matching in-stock product" : "No in-stock products"}
            </span>
          </div>
        )
      ) : null}
    </div>
  );
}

function EditableDocumentTemplate({
  document,
  companyConfig,
  onDocumentChange,
  onCustomerChange,
  customerPickerProps,
  productOptions,
  productById,
  productLoading,
  productError,
  onEventChange,
  onLineItemChange,
  onLineItemDescriptionChange,
  onLineItemSelectProduct,
  onAddLineItem,
  onAddHeadingLine,
  onAddNoteLine,
  onMoveLineItem,
  onRemoveLineItem,
  onAdditionalItemChange,
  onAddAdditionalItem,
  onRemoveAdditionalItem,
}) {
  const summary = document.summary;
  const lineItemSummary = summarizeLineItems(document.lineItems);
  const [draggedRowId, setDraggedRowId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const showEventCard =
    document.documentType === "invoice" ||
    document.event?.eventDate ||
    document.event?.venueAddress ||
    document.event?.startTime ||
    document.event?.endTime;

  const handleRowDragStart = useCallback((event, itemId) => {
    setDraggedRowId(itemId);
    setDropTargetId(itemId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  }, []);

  const handleRowDragEnd = useCallback(() => {
    setDraggedRowId(null);
    setDropTargetId(null);
  }, []);

  const handleRowDragOver = useCallback(
    (event, targetId) => {
      if (!draggedRowId || draggedRowId === targetId) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTargetId(targetId);
    },
    [draggedRowId]
  );

  const handleRowDrop = useCallback(
    (event, targetId) => {
      event.preventDefault();
      const sourceId = draggedRowId || event.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId) {
        setDraggedRowId(null);
        setDropTargetId(null);
        return;
      }
      onMoveLineItem(sourceId, targetId);
      setDraggedRowId(null);
      setDropTargetId(null);
    },
    [draggedRowId, onMoveLineItem]
  );

  return (
    <div className="invoice-paper invoice-hub-paper invoice-editable-paper">
      <div className="invoice-header invoice-editable-header">
        <div className="invoice-brand">
          <img className="invoice-logo" src={COMPANY.logo} alt="Reebs logo" />
          <div>
            <h2>{companyConfig.storeName || COMPANY.name}</h2>
            <p>{companyConfig.storeAddress || COMPANY.location}</p>
            <p>{companyConfig.storePhone || COMPANY.phone}</p>
            <p>{companyConfig.storeEmail || COMPANY.email}</p>
          </div>
        </div>

        <div className="invoice-editable-meta-wrap">
          <div className="invoice-meta invoice-editable-meta">
            <label className="invoice-editable-meta-field">
              <span className="invoicing-label">Type</span>
              <SelectField
                value={document.documentType}
                onChange={(event) =>
                  onDocumentChange((current) => ({
                    ...current,
                    documentType: event.target.value,
                    docLabel: event.target.value === "receipt" ? "Receipt" : "Invoice",
                  }))
                }
                disabled={document.sourceType !== "manual"}
              >
                <option value="receipt">Receipt</option>
                <option value="invoice">Invoice</option>
              </SelectField>
            </label>

            <label className="invoice-editable-meta-field">
              <span className="invoicing-label">Date</span>
              <DateField
                value={document.issueDate}
                onChange={(event) => onDocumentChange({ issueDate: event.target.value })}
              />
            </label>
            <label className="invoice-editable-meta-field">
              <span className="invoicing-label">Status</span>
              <SelectField
                value={document.paymentStatus}
                onChange={(event) => onDocumentChange({ paymentStatus: event.target.value })}
              >
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </label>

            <label className="invoice-editable-meta-field invoice-editable-field-full">
              <span className="invoicing-label">{getInvoiceDueDateLabel(document)}</span>
              <div className="invoice-editable-due-date-row">
                <SelectField
                  value={document.dueDateOption || defaultDueDateOptionForType(document.documentType)}
                  onChange={(event) => onDocumentChange({ dueDateOption: event.target.value })}
                >
                  {getDueDateOptionsForType(document.documentType).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>
                <DateField
                  value={document.dueDate || ""}
                  aria-label="Actual due date"
                  onChange={(event) =>
                    onDocumentChange({
                      dueDate: event.target.value,
                      dueDateOption: event.target.value
                        ? "custom"
                        : defaultDueDateOptionForType(document.documentType),
                    })
                  }
                />
              </div>
            </label>
          </div>
        </div>
      </div>

      {document.documentType === "invoice" ? (
      <div className="invoice-chip-row invoice-editable-chip-row">

          <span className="invoice-chip-detail">
            {summary.fullPaymentDue ? "Due" : "Balance"} {formatCurrency(
              summary.fullPaymentDue ? summary.depositAmount : summary.balanceDue,
              companyConfig.currency
            )}
          </span>
        
      </div>
      ) : null}
      <div className="invoice-hub-preview-grid invoice-editable-top-grid">
        <article className="invoice-hub-mini-card invoice-editable-card">
          <p className="invoicing-label">Bill to</p>
          <div className="invoice-editable-card-grid">
            <label className="invoice-editable-field invoice-editable-field-full">
              <span>Customer</span>
              <InvoiceCustomerPicker {...customerPickerProps} />
            </label>
            <label className="invoice-editable-field invoice-editable-field-full">
              <span>Phone</span>
              <input
                type="text"
                value={document.customer?.phone || ""}
                onChange={(event) => onCustomerChange("phone", event.target.value)}
              />
            </label>
            <label className="invoice-editable-field invoice-editable-field-full">
              <span>Email</span>
              <input
                type="email"
                value={document.customer?.email || ""}
                onChange={(event) => onCustomerChange("email", event.target.value)}
              />
            </label>
          </div>
        </article>

        {showEventCard ? (
          <article className="invoice-hub-mini-card invoice-editable-card">
            <p className="invoicing-label">Event</p>
            <div className="invoice-editable-card-grid">
              <label className="invoice-editable-field invoice-editable-field-full">
                <span>Date</span>
                <DateField
                  value={document.event?.eventDate || ""}
                  onChange={(event) => onEventChange("eventDate", event.target.value)}
                />
              </label>
              <label className="invoice-editable-field">
                <span>Start</span>
                <input
                  type="text"
                  value={document.event?.startTime || ""}
                  onChange={(event) => onEventChange("startTime", event.target.value)}
                  placeholder="10:00"
                />
              </label>
              <label className="invoice-editable-field">
                <span>End</span>
                <input
                  type="text"
                  value={document.event?.endTime || ""}
                  onChange={(event) => onEventChange("endTime", event.target.value)}
                  placeholder="14:00"
                />
              </label>
              <label className="invoice-editable-field invoice-editable-field-full">
                <span>Venue</span>
                <input
                  type="text"
                  value={document.event?.venueAddress || ""}
                  onChange={(event) => onEventChange("venueAddress", event.target.value)}
                />
              </label>
            </div>
          </article>
        ) : null}
      </div>

      <section className="invoice-editable-lines-panel">
        <div className="invoice-editable-lines-head">
          <div>
            <h4>Product Items</h4>
            {productLoading ? <p className="invoice-editable-lines-helper">Loading products...</p> : null}
            {!productLoading && productError ? (
              <p className="invoice-editable-lines-helper">{productError}</p>
            ) : null}
          </div>

          <div className="invoice-editable-actions">
            <span className="invoice-editable-lines-count">{lineItemSummary.rows} rows</span>
            <button
              type="button"
              className="admin-secondary invoice-hub-inline-action"
              onClick={onAddHeadingLine}
            >
              Heading
            </button>
            <button
              type="button"
              className="admin-secondary invoice-hub-inline-action"
              onClick={onAddNoteLine}
            >
              Note
            </button>
          </div>
        </div>

        <div className="invoice-editable-table-shell">
          <div className="admin-table admin-table-scroll inventory-table-scroll invoice-editable-table-wrapper">
          <table className="invoice-editable-table">
            <thead>
              <tr>
                <th className="invoice-editable-col-add" data-column="add" aria-label="Add row" />
                <th className="invoice-editable-col-description" data-column="description">Description</th>
                <th className="invoice-editable-col-qty" data-column="quantity">Qty</th>
                <th className="invoice-editable-col-price" data-column="price">Price</th>
                <th className="invoice-editable-col-unit" data-column="unit">Rate</th>
                <th className="invoice-editable-col-total" data-column="total">Total</th>
                <th className="invoice-editable-col-actions" data-column="actions" />
              </tr>
            </thead>
            <tbody>
              {document.lineItems.map((item, index) => (
                isHeadingLineItem(item) ? (
                  <tr
                    key={item.id}
                    className={`invoice-editable-table-row is-heading${dropTargetId === item.id && draggedRowId !== item.id ? " is-drop-target" : ""}`}
                    draggable="true"
                    onDragStart={(event) => handleRowDragStart(event, item.id)}
                    onDragEnd={handleRowDragEnd}
                    onDragOver={(event) => handleRowDragOver(event, item.id)}
                    onDrop={(event) => handleRowDrop(event, item.id)}
                  >
                    <td className="invoice-editable-col-add" data-column="add" data-label="">
                      <button
                        type="button"
                        className="invoice-editable-row-add"
                        onClick={() => onAddLineItem(item.id)}
                        aria-label={`Add row below heading ${index}`}
                      >
                        <AppIcon icon={faPlus} />
                      </button>
                    </td>
                    <td className="invoice-editable-col-description invoice-editable-col-merged" data-column="description" data-label="Heading" colSpan={5}>
                      <div className="invoice-heading-builder">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) =>
                            onLineItemDescriptionChange(item.id, event.target.value, "heading")
                          }
                          placeholder="Rental items"
                          aria-label={`Heading ${index}`}
                        />
                      </div>
                    </td>
                    <td className="invoice-editable-col-actions" data-column="actions" data-label="">
                      <button
                        type="button"
                        className="invoice-hub-line-remove"
                        onClick={() => onRemoveLineItem(item.id)}
                        disabled={document.lineItems.length <= 1}
                        aria-label={`Remove heading ${index}`}
                      >
                        <AppIcon icon={faXmark} />
                      </button>
                    </td>
                  </tr>
                ) : isNoteLineItem(item) ? (
                  <tr
                    key={item.id}
                    className={`invoice-editable-table-row is-note${dropTargetId === item.id && draggedRowId !== item.id ? " is-drop-target" : ""}`}
                    draggable="true"
                    onDragStart={(event) => handleRowDragStart(event, item.id)}
                    onDragEnd={handleRowDragEnd}
                    onDragOver={(event) => handleRowDragOver(event, item.id)}
                    onDrop={(event) => handleRowDrop(event, item.id)}
                  >
                    <td className="invoice-editable-col-add" data-column="add" data-label="">
                      <button
                        type="button"
                        className="invoice-editable-row-add"
                        onClick={() => onAddLineItem(item.id)}
                        aria-label={`Add row below note ${index}`}
                      >
                        <AppIcon icon={faPlus} />
                      </button>
                    </td>
                    <td className="invoice-editable-col-description invoice-editable-col-merged" data-column="description" data-label="Note" colSpan={5}>
                      <div className="invoice-note-builder">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(event) =>
                            onLineItemDescriptionChange(item.id, event.target.value, "note")
                          }
                          placeholder="Pickup note"
                          aria-label={`Note ${index}`}
                        />
                      </div>
                    </td>
                    <td className="invoice-editable-col-actions" data-column="actions" data-label="">
                      <button
                        type="button"
                        className="invoice-hub-line-remove"
                        onClick={() => onRemoveLineItem(item.id)}
                        disabled={document.lineItems.length <= 1}
                        aria-label={`Remove note ${index}`}
                      >
                        <AppIcon icon={faXmark} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    className={`invoice-editable-table-row${dropTargetId === item.id ? " is-drop-target" : ""}`}
                    onDragOver={(event) => handleRowDragOver(event, item.id)}
                    onDrop={(event) => handleRowDrop(event, item.id)}
                  >
                    <td className="invoice-editable-col-add" data-column="add" data-label="">
                      <button
                        type="button"
                        className="invoice-editable-row-add"
                        onClick={() => onAddLineItem(item.id)}
                        aria-label={`Add row below line ${index}`}
                      >
                        <AppIcon icon={faPlus} />
                      </button>
                    </td>
                    <td className="invoice-editable-col-description" data-column="description" data-label="Description">
                      <InvoiceProductPicker
                        value={item.name}
                        onChange={(nextValue) => onLineItemDescriptionChange(item.id, nextValue, "item")}
                        onSelectProduct={(product) => onLineItemSelectProduct(item.id, product)}
                        products={productOptions}
                        document={document}
                        currentItem={item}
                        selectedProductId={item.productId}
                      />
                    </td>
                    <td className="invoice-editable-col-qty" data-column="quantity" data-label="Qty">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={item.quantity}
                        max={resolveLineItemMaxQuantity(document, item, productById) ?? undefined}
                        onChange={(event) => onLineItemChange(item.id, "quantity", event.target.value)}
                        aria-label={`Line ${index} quantity`}
                        title={
                          resolveLineItemMaxQuantity(document, item, productById) != null
                            ? `${resolveLineItemMaxQuantity(document, item, productById)} available in stock`
                            : "Quantity"
                        }
                      />
                    </td>
                    <td className="invoice-editable-col-price" data-column="price" data-label="Price">
                      <div
                        className="invoice-editable-static-field"
                        aria-label={`Line ${index} price`}
                      >
                        {formatCurrency(item.unitPrice, companyConfig.currency)}
                      </div>
                    </td>
                    <td className="invoice-editable-col-unit" data-column="unit" data-label="Rate">
                      <div
                        className="invoice-editable-static-field"
                        aria-label={`Line ${index} rate`}
                      >
                        {item.unitLabel || DEFAULT_LINE_ITEM_UNIT}
                      </div>
                    </td>
                    <td className="invoice-editable-col-total" data-column="total" data-label="Total">
                      <strong>{formatCurrency(item.total, companyConfig.currency)}</strong>
                    </td>
                    <td className="invoice-editable-col-actions" data-column="actions" data-label="">
                      <button
                        type="button"
                        className="invoice-hub-line-remove"
                        onClick={() => onRemoveLineItem(item.id)}
                        disabled={document.lineItems.length <= 1}
                        aria-label={`Remove line ${index}`}
                      >
                        <AppIcon icon={faXmark} />
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
            <tfoot className="admin-table-footer">
            {document.lineItems.length > 0 ? (
                <tr>
                  <td className="admin-table-summary-cell is-empty invoice-editable-col-add" />
                  <td className="admin-table-summary-cell invoice-editable-col-description">
                    <span className="admin-table-summary-value">Totals</span>
                  </td>
                  <td className="admin-table-summary-cell invoice-editable-col-qty">
                    <span className="admin-table-summary-value">{lineItemSummary.quantity}</span>
                  </td>
                  <td className="admin-table-summary-cell invoice-editable-col-price">
                    <span className="admin-table-summary-value">
                      {formatCurrency(lineItemSummary.priceTotal, companyConfig.currency)}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell is-empty invoice-editable-col-unit" />
                  <td className="admin-table-summary-cell invoice-editable-col-total">
                    <span className="admin-table-summary-value">
                      {formatCurrency(lineItemSummary.total, companyConfig.currency)}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell is-empty invoice-editable-col-actions" />
                </tr>
            ) : null}
              </tfoot>
          </table>
          </div>
        </div>
      </section>

      <section className="invoice-editable-lines-panel invoice-editable-extras-panel">
        <div className="invoice-editable-lines-head">
          <div>
            <h4>Expenses</h4>
            <p className="invoice-editable-lines-helper">Transportation, attendant fees and other charges</p>
          </div>
          <div className="invoice-editable-actions">
            <span className="invoice-editable-lines-count">{(document.additionalItems || []).length} rows</span>
            <button
              type="button"
              className="admin-secondary invoice-hub-inline-action"
              onClick={onAddAdditionalItem}
            >
              Add row
            </button>
          </div>
        </div>

        <div className="invoice-editable-table-shell">
          <div className="admin-table admin-table-scroll inventory-table-scroll invoice-editable-table-wrapper">
            <table className="invoice-editable-table invoice-extras-table">
              <thead>
                <tr>
                  <th className="invoice-editable-col-description" data-column="description">Description</th>
                  <th className="invoice-editable-col-qty" data-column="quantity">Qty</th>
                  <th className="invoice-editable-col-unit" data-column="unit">Rate</th>
                  <th className="invoice-editable-col-price" data-column="price">Price</th>
                  <th className="invoice-editable-col-total" data-column="total">Total</th>
                  <th className="invoice-editable-col-actions" data-column="actions" />
                </tr>
              </thead>
              <tbody>
                {(document.additionalItems || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="invoice-extras-empty">
                      No expense rows yet — use &ldquo;Add row&rdquo; to add transportation, attendant fees, etc.
                    </td>
                  </tr>
                ) : (
                  (document.additionalItems || []).map((item, index) => (
                    <tr key={item.id} className="invoice-editable-table-row">
                      <td className="invoice-editable-col-description" data-column="description" data-label="Description">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(event) => onAdditionalItemChange(item.id, "description", event.target.value)}
                          placeholder="e.g. Transportation to venue"
                          aria-label={`Expense ${index + 1} description`}
                          className="invoice-extras-description-input"
                        />
                      </td>
                      <td className="invoice-editable-col-qty" data-column="quantity" data-label="Qty">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.quantity}
                          onChange={(event) => onAdditionalItemChange(item.id, "quantity", event.target.value)}
                          aria-label={`Expense ${index + 1} quantity`}
                        />
                      </td>
                      <td className="invoice-editable-col-unit" data-column="unit" data-label="Rate">
                        <input
                          type="text"
                          value={item.unitLabel}
                          onChange={(event) => onAdditionalItemChange(item.id, "unitLabel", event.target.value)}
                          placeholder="Per item"
                          aria-label={`Expense ${index + 1} rate label`}
                          className="invoice-extras-unit-input"
                        />
                      </td>
                      <td className="invoice-editable-col-price" data-column="price" data-label="Price">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) => onAdditionalItemChange(item.id, "unitPrice", event.target.value)}
                          aria-label={`Expense ${index + 1} unit price`}
                        />
                      </td>
                      <td className="invoice-editable-col-total" data-column="total" data-label="Total">
                        <strong>{formatCurrency(item.total, companyConfig.currency)}</strong>
                      </td>
                      <td className="invoice-editable-col-actions" data-column="actions" data-label="">
                        <button
                          type="button"
                          className="invoice-hub-line-remove"
                          onClick={() => onRemoveAdditionalItem(item.id)}
                          aria-label={`Remove expense ${index + 1}`}
                        >
                          <AppIcon icon={faXmark} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {(document.additionalItems || []).length > 0 ? (
                <tfoot className="admin-table-footer">
                  <tr>
                    <td className="admin-table-summary-cell invoice-editable-col-description">
                      <span className="admin-table-summary-value">Expenses total</span>
                    </td>
                    <td className="admin-table-summary-cell invoice-editable-col-qty" />
                    <td className="admin-table-summary-cell invoice-editable-col-unit" />
                    <td className="admin-table-summary-cell invoice-editable-col-price" />
                    <td className="admin-table-summary-cell invoice-editable-col-total">
                      <span className="admin-table-summary-value">
                        {formatCurrency(summary.additionalTotal, companyConfig.currency)}
                      </span>
                    </td>
                    <td className="admin-table-summary-cell invoice-editable-col-actions is-empty" />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </section>
        <div className="invoice-note-block invoice-editable-note-block">
          <div className="invoice-editable-section-head">
            <p className="invoicing-label">Message</p>
          </div>

          <h4>Note</h4>
          <textarea
            rows="4"
            value={document.notes}
            onChange={(event) => onDocumentChange({ notes: event.target.value })}
          />

          <h4>Terms</h4>
          <textarea
            rows="4"
            value={document.terms}
            onChange={(event) => onDocumentChange({ terms: event.target.value })}
          />
        </div>

        <div className="invoice-summary-panel invoice-editable-summary">
          <div className="invoice-editable-section-head">
            <p className="invoicing-label">Summary</p>
          </div>

          <div className="invoice-totals">

            {document.documentType === "invoice" ? (
              <div className="invoice-total-row">
                <span>{getInvoiceDepositLabel(document)}</span>
                <span>{formatCurrency(summary.depositAmount, companyConfig.currency)}</span>
              </div>
            ) : null}
          </div>

          <div className="invoice-totals">

            {document.documentType === "invoice" ? (
              <div className="invoice-total-row">
                <span>Discount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={document.discountAmount}
                  onChange={(event) =>
                    onDocumentChange({ discountAmount: toNumber(event.target.value, 0) })
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="invoice-totals">
            <div className="invoice-total-row">
              <span>Subtotal</span>
              <span>{formatCurrency(summary.subtotal, companyConfig.currency)}</span>
            </div>
            {summary.additionalTotal > 0 ? (
              <div className="invoice-total-row">
                <span>Expenses</span>
                <span>{formatCurrency(summary.additionalTotal, companyConfig.currency)}</span>
              </div>
            ) : null}
            <div className="invoice-total-row grand">
              <strong>Total</strong>
              <strong>{formatCurrency(summary.grandTotal, companyConfig.currency)}</strong>
            </div>
            {document.documentType === "invoice" ? (
              <>
                <div className="invoice-total-row">
                  <span>{getInvoiceDepositLabel(document)}</span>
                  <span>{formatCurrency(summary.depositAmount, companyConfig.currency)}</span>
                </div>
                <div className="invoice-total-row">
                  <span>Discount</span>
                  <span>-{formatCurrency(summary.discountTotal, companyConfig.currency)}</span>
                </div>
                {!summary.fullPaymentDue ? (
                  <div className="invoice-total-row">
                    <span>{getInvoiceBalanceLabel()}</span>
                    <span>{formatCurrency(summary.balanceDue, companyConfig.currency)}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="invoice-total-row">
                <span>Paid</span>
                <span>{formatCurrency(summary.amountPaid, companyConfig.currency)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

function AdminInvoicing() {
  const [config, setConfig] = useState(loadConfig);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState("");
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerError, setCustomerError] = useState("");
  const [invoiceCustomerMenuOpen, setInvoiceCustomerMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [documentFilter, setDocumentFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [savingDocument, setSavingDocument] = useState(false);
  const [autosavingDocument, setAutosavingDocument] = useState(false);
  const [creatingDocument, setCreatingDocument] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savingPdfDocument, setSavingPdfDocument] = useState(false);
  const [emailingDocument, setEmailingDocument] = useState(false);
  const [archivingDocument, setArchivingDocument] = useState(false);
  const [restoredEditorFromUrl, setRestoredEditorFromUrl] = useState(false);
  const autosaveTimerRef = useRef(null);
  const lastPersistedPayloadRef = useRef("");
  const latestDraftPayloadRef = useRef("");
  const currentSelectedKeyRef = useRef("");
  const skipNextSelectedLoadKeyRef = useRef("");
  const hasLoadedCustomersRef = useRef(false);
  const hasLoadedProductsRef = useRef(false);
  // Always holds the latest finalizeWorkingDocument without forcing persistDocument
  // to re-create every time productById changes (which would re-trigger the autosave effect).
  const finalizeWorkingDocumentRef = useRef(null);

  useEffect(() => {
    document.body.classList.add("admin-theme");
    return () => document.body.classList.remove("admin-theme");
  }, []);

  useEffect(() => {
    setConfig(loadConfig());
    const handleStorage = (event) => {
      if (event.key === "reebs_erp_config") {
        setConfig(loadConfig());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const defaultTaxRate = useMemo(() => parseTaxRate(config?.taxRate), [config]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const response = await fetch("/.netlify/functions/orders?compact=1");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load orders.");
      }
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Orders fetch failed", err);
      setOrdersError(err.message || "Unable to load orders.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError("");
    try {
      const response = await fetch("/.netlify/functions/bookings?compact=1");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load bookings.");
      }
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Bookings fetch failed", err);
      setBookingsError(err.message || "Unable to load bookings.");
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  const fetchSavedDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError("");
    try {
      const response = await fetch("/.netlify/functions/invoice-documents?compact=1");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load invoice documents.");
      }
      setSavedDocuments(Array.isArray(data) ? data.map(normalizeSavedDocumentListRecord) : []);
    } catch (err) {
      console.error("Invoice documents fetch failed", err);
      setDocumentsError(err.message || "Unable to load invoice documents.");
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  const fetchSavedDocumentById = useCallback(async (id) => {
    const data = await fetchInvoiceDocumentById(id);
    return normalizeSavedDocumentRecord(data);
  }, []);

  const fetchCustomers = useCallback(async () => {
    setCustomerError("");
    try {
      const response = await fetch("/.netlify/functions/customers?compact=1");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load customers.");
      }
      setCustomers(Array.isArray(data) ? data : []);
      hasLoadedCustomersRef.current = true;
    } catch (err) {
      console.error("Customer fetch failed", err);
      setCustomerError(err.message || "Customer directory is unavailable right now.");
      setCustomers([]);
      hasLoadedCustomersRef.current = false;
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductError("");
    try {
      const { items } = await fetchInventoryWithCache();
      setProducts(extractInventoryItems(items));
      hasLoadedProductsRef.current = true;
    } catch (err) {
      console.error("Product fetch failed", err);
      setProductError(err.message || "Product directory is unavailable right now.");
      setProducts([]);
      hasLoadedProductsRef.current = false;
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchOrders(), fetchBookings(), fetchSavedDocuments()]);
  }, [fetchBookings, fetchOrders, fetchSavedDocuments]);

  const readDocumentKeyFromUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const searchParams = new URLSearchParams(window.location.search);
    const documentKey = searchParams.get(DOCUMENT_QUERY_PARAM) || "";
    if (documentKey) return documentKey;

    const sourceType = String(searchParams.get("type") || "")
      .trim()
      .toLowerCase();
    const sourceId = Number(searchParams.get("id"));
    if (!Number.isFinite(sourceId) || sourceId <= 0) return "";
    if (sourceType === "orders" || sourceType === "order") {
      return buildEntryKey("orders", sourceId);
    }
    if (sourceType === "bookings" || sourceType === "booking") {
      return buildEntryKey("bookings", sourceId);
    }
    return "";
  }, []);

  const syncDocumentKeyToUrl = useCallback((entryKey) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (entryKey) {
      url.searchParams.set(DOCUMENT_QUERY_PARAM, entryKey);
    } else {
      url.searchParams.delete(DOCUMENT_QUERY_PARAM);
    }
    url.searchParams.delete("type");
    url.searchParams.delete("id");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (!editorOpen) return;
    if (!hasLoadedCustomersRef.current) {
      fetchCustomers();
    }
    if (!hasLoadedProductsRef.current) {
      fetchProducts();
    }
  }, [editorOpen, fetchCustomers, fetchProducts]);

  const archivedLinkedKeys = useMemo(() => {
    const keys = new Set();
    savedDocuments.forEach((document) => {
      if (document.archivedAt && document.sourceType !== "manual" && document.sourceId) {
        keys.add(buildEntryKey(document.sourceType, document.sourceId));
      }
    });
    return keys;
  }, [savedDocuments]);

  const customerById = useMemo(
    () =>
      new Map(
        customers
          .map((customer) => [Number(customer.id), customer])
          .filter(([id]) => Number.isFinite(id) && id > 0)
      ),
    [customers]
  );

  const productById = useMemo(
    () =>
      new Map(
        products
          .map((product) => [Number(product.id), product])
          .filter(([id]) => Number.isFinite(id) && id > 0)
      ),
    [products]
  );

  const finalizeWorkingDocument = useCallback(
    (nextDocument, currentDocument = null) => {
      if (!nextDocument) return null;
      const hydratedDocument = syncDocumentLifecycle({
        ...nextDocument,
        lineItems: clearLegacyDraftLineItemPlaceholders(
          ensureEditableLineItems(nextDocument.lineItems),
          nextDocument.sourceType
        ),
        expenses: normalizeExpenses(nextDocument.expenses),
        additionalItems: normalizeAdditionalItems(nextDocument.additionalItems),
      });
      const policySyncedDocument = syncManagedPolicyCopy(currentDocument, hydratedDocument, productById);
      const dueDateSyncedDocument = syncDueDateFlow(policySyncedDocument);
      const stockClampedDocument = clampDocumentLineItemsToStock(dueDateSyncedDocument, productById);
      return computeDocumentSummary(stockClampedDocument);
    },
    [productById]
  );
  // Keep the ref pointing at the latest version so persistDocument can call it
  // without being re-created (and re-triggering the autosave effect) every time
  // productById changes.
  finalizeWorkingDocumentRef.current = finalizeWorkingDocument;

  const openDocumentEditor = useCallback(
    (entryKey, document, { saveMessage = "" } = {}) => {
      const payloadString = JSON.stringify(buildStoredPayload(document));
      skipNextSelectedLoadKeyRef.current = entryKey;
      currentSelectedKeyRef.current = entryKey;
      lastPersistedPayloadRef.current = payloadString;
      latestDraftPayloadRef.current = payloadString;
      writeInvoiceDraft(entryKey, document);
      setSaveError("");
      setSelectedError("");
      setSelectedLoading(false);
      setSelectedDocument(document);
      setEditorOpen(true);
      setSelectedKey(entryKey);
      if (saveMessage) {
        setSaveStatus(saveMessage);
      }
    },
    []
  );

  const savedLinkedMap = useMemo(() => {
    const map = new Map();
    savedDocuments.forEach((document) => {
      if (!document.archivedAt && document.sourceType !== "manual" && document.sourceId) {
        map.set(buildEntryKey(document.sourceType, document.sourceId), document);
      }
    });
    return map;
  }, [savedDocuments]);

  const manualDocuments = useMemo(
    () => savedDocuments.filter((document) => document.sourceType === "manual" && !document.archivedAt),
    [savedDocuments]
  );

  const documentEntries = useMemo(() => {
    const entries = [];

    orders.forEach((order) => {
      const key = buildEntryKey("orders", order.id);
      if (archivedLinkedKeys.has(key)) return;
      const override = savedLinkedMap.get(key);
      const amount = override ? override.summary?.grandTotal ?? 0 : toNumber(order.total, 0);
      entries.push({
        key,
        id: override?.id || null,
        sourceType: "orders",
        sourceId: order.id,
        documentType: override?.documentType || "receipt",
        invoiceNumber: getDocumentNumberValue(override?.invoiceNumber),
        customerName: override?.customer?.name || order.customerName || "Customer",
        issueDate: override?.issueDate || normalizeDateInput(order.date || order.orderDate || order.createdAt) || todayValue(),
        paymentStatus: override?.paymentStatus || "draft",
        total: amount,
        linkedLabel: order.orderNumber ? `Order ${order.orderNumber}` : `Order #${order.id}`,
        sourceLabel: "Order",
        isManual: false,
        updatedAt: override?.updatedAt || order.lastModifiedAt || order.updatedAt || order.createdAt || null,
      });
    });

    bookings.forEach((booking) => {
      const key = buildEntryKey("bookings", booking.id);
      if (archivedLinkedKeys.has(key)) return;
      const override = savedLinkedMap.get(key);
      const amount = override ? override.summary?.grandTotal ?? 0 : toNumber(booking.totalAmount, 0) / 100;
      entries.push({
        key,
        id: override?.id || null,
        sourceType: "bookings",
        sourceId: booking.id,
        documentType: override?.documentType || "invoice",
        invoiceNumber: getDocumentNumberValue(override?.invoiceNumber),
        customerName: override?.customer?.name || booking.customerName || "Customer",
        issueDate: override?.issueDate || normalizeDateInput(booking.eventDate) || todayValue(),
        paymentStatus: override?.paymentStatus || "draft",
        total: amount,
        linkedLabel: `Booking #${booking.id}`,
        sourceLabel: "Booking",
        isManual: false,
        updatedAt: override?.updatedAt || booking.lastModifiedAt || booking.updatedAt || booking.createdAt || null,
      });
    });

    manualDocuments.forEach((document) => {
      entries.push({
        key: buildEntryKey("manual", null, document.id),
        id: document.id,
        sourceType: "manual",
        sourceId: null,
        documentType: document.documentType,
        invoiceNumber: getDocumentNumberValue(document.invoiceNumber),
        customerName: document.customer?.name || "Customer",
        issueDate: document.issueDate,
        paymentStatus: document.paymentStatus,
        total: document.summary?.grandTotal ?? 0,
        linkedLabel: document.linkedLabel || MANUAL_LINKED_LABEL,
        sourceLabel: document.sourceLabel || MANUAL_SOURCE_LABEL,
        isManual: true,
        updatedAt: document.updatedAt || document.createdAt || null,
      });
    });

    return entries.sort((left, right) => {
      const leftDate = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightDate = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return rightDate - leftDate || String(left.invoiceNumber).localeCompare(String(right.invoiceNumber));
    });
  }, [orders, bookings, manualDocuments, savedLinkedMap, archivedLinkedKeys]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const visibleEntries = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    return documentEntries.filter((entry) => {
      if (documentFilter === "receipt" && entry.documentType !== "receipt") return false;
      if (documentFilter === "invoice" && entry.documentType !== "invoice") return false;
      if (paymentStatusFilter !== "all" && entry.paymentStatus !== paymentStatusFilter) return false;
      if (!term) return true;
      const blob = [
        getDocumentTableReference(entry),
        entry.customerName,
        entry.linkedLabel,
        entry.sourceLabel,
        entry.paymentStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(term);
    });
  }, [deferredSearchTerm, documentEntries, documentFilter, paymentStatusFilter]);

  const upsertSavedDocument = useCallback((saved) => {
    setSavedDocuments((current) => {
      const next = current.filter((document) => {
        if (document.id === saved.id) return false;
        if (
          saved.sourceType !== "manual" &&
          document.sourceType === saved.sourceType &&
          document.sourceId === saved.sourceId
        ) {
          return false;
        }
        return true;
      });
      return [saved, ...next];
    });
  }, []);

  const persistDocument = useCallback(
    async (documentToPersist, { autosave = false, documentKey = "" } = {}) => {
      if (!documentToPersist) return null;
      const payload = buildStoredPayload(documentToPersist);
      const payloadString = JSON.stringify(payload);

      if (autosave) {
        setAutosavingDocument(true);
      } else {
        setSavingDocument(true);
        setSaveError("");
        setSaveStatus("");
      }

      try {
        const response = await fetch("/.netlify/functions/invoice-documents", {
          method: documentToPersist.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadString,
        });
        if (!response.ok) {
          throw new Error(await readResponseError(response, "Failed to save document."));
        }
        const data = await response.json();
        const saved = normalizeSavedDocumentRecord(data);
        const nextKey = buildEntryKey(saved.sourceType, saved.sourceId, saved.id);
        const canApplyToEditor = !documentKey || currentSelectedKeyRef.current === documentKey;

        if (canApplyToEditor) {
          skipNextSelectedLoadKeyRef.current = nextKey;
          currentSelectedKeyRef.current = nextKey;
        }

        upsertSavedDocument(saved);

        if (saved.stockCommittedAt || documentToPersist.stockCommittedAt) {
          await fetchProducts();
        }

        if (canApplyToEditor) {
          setSelectedKey(nextKey);

          if (autosave) {
            // For autosave: only patch in server-assigned metadata so that any
            // keystrokes the user made while the request was in flight are kept.
            // Never overwrite user-editable content fields with the stale copy
            // that was sent to the server 700 ms ago.
            setSelectedDocument((current) => {
              if (!current) {
                // No live document — fall back to a full merge.
                return finalizeWorkingDocumentRef.current(
                  mergeDocument(documentToPersist, saved),
                  documentToPersist
                );
              }
              const withServerMeta = {
                ...current,
                id: saved.id || current.id,
                invoiceNumber: saved.invoiceNumber || current.invoiceNumber,
                updatedAt: saved.updatedAt || current.updatedAt,
                createdAt: saved.createdAt || current.createdAt,
                stockCommittedAt: saved.stockCommittedAt || current.stockCommittedAt || null,
                sentAt: saved.sentAt || current.sentAt || null,
                sentToEmail: saved.sentToEmail || current.sentToEmail || "",
              };
              return finalizeWorkingDocumentRef.current(withServerMeta, current);
            });
          } else {
            // Manual save: the user explicitly clicked Save, so a full merge is safe.
            const nextDocument = finalizeWorkingDocumentRef.current(
              mergeDocument(documentToPersist, saved),
              documentToPersist
            );
            const nextPayloadString = JSON.stringify(buildStoredPayload(nextDocument));
            lastPersistedPayloadRef.current = nextPayloadString;
            setSelectedDocument((current) =>
              finalizeWorkingDocumentRef.current(
                mergeDocument(current || documentToPersist, saved),
                current || documentToPersist
              )
            );
            writeInvoiceDraft(nextKey, nextDocument);
          }

          setSaveStatus(autosave ? "" : "Saved.");
        }

        // Always update the persisted payload ref so the autosave guard works.
        lastPersistedPayloadRef.current = JSON.stringify(buildStoredPayload(
          mergeDocument(documentToPersist, saved)
        ));

        return saved;
      } catch (err) {
        console.error("Save document failed", err);
        setSaveError(err.message || "Failed to save document.");
        return null;
      } finally {
        if (autosave) {
          setAutosavingDocument(false);
        } else {
          setSavingDocument(false);
        }
      }
    },
    // finalizeWorkingDocument intentionally excluded — accessed via ref so that
    // productById changes don't recreate this callback and re-fire the autosave effect.
    [fetchProducts, upsertSavedDocument]  
  );

  useEffect(() => {
    if (!visibleEntries.length) {
      setSelectedKey("");
      setSelectedDocument(null);
      setSelectedError("");
      setSelectedLoading(false);
      setEditorOpen(false);
      return;
    }
    if (selectedKey && !visibleEntries.some((entry) => entry.key === selectedKey)) {
      setSelectedKey("");
      setSelectedDocument(null);
      setSelectedError("");
      setSelectedLoading(false);
      setEditorOpen(false);
    }
  }, [visibleEntries, selectedKey]);

  const selectedEntry = useMemo(
    () => documentEntries.find((entry) => entry.key === selectedKey) || null,
    [documentEntries, selectedKey]
  );

  useEffect(() => {
    currentSelectedKeyRef.current = selectedKey;
  }, [selectedKey]);

  useEffect(() => {
    if (restoredEditorFromUrl) return;
    const urlDocumentKey = readDocumentKeyFromUrl();
    if (!urlDocumentKey) {
      setRestoredEditorFromUrl(true);
      return;
    }
    const parsedUrlDocumentKey = parseEntryKey(urlDocumentKey);
    const waitingForLinkedSource =
      parsedUrlDocumentKey?.sourceType === "orders"
        ? ordersLoading
        : parsedUrlDocumentKey?.sourceType === "bookings"
          ? bookingsLoading
          : false;
    if (documentsLoading || waitingForLinkedSource) return;
    const matchingEntry = documentEntries.find((entry) => entry.key === urlDocumentKey) || null;
    if (!matchingEntry) {
      syncDocumentKeyToUrl("");
      setRestoredEditorFromUrl(true);
      return;
    }
    setSaveError("");
    setSaveStatus("");
    setSelectedError("");
    setSelectedDocument(null);
    setSelectedLoading(true);
    setEditorOpen(true);
    setSelectedKey(urlDocumentKey);
    setRestoredEditorFromUrl(true);
  }, [
    restoredEditorFromUrl,
    readDocumentKeyFromUrl,
    syncDocumentKeyToUrl,
    documentsLoading,
    documentEntries,
    bookingsLoading,
    ordersLoading,
  ]);

  useEffect(() => {
    if (!restoredEditorFromUrl) return;
    syncDocumentKeyToUrl(editorOpen && selectedKey ? selectedKey : "");
  }, [editorOpen, restoredEditorFromUrl, selectedKey, syncDocumentKeyToUrl]);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedDocument = async () => {
      if (!selectedEntry) {
        setSelectedDocument(null);
        setSelectedError("");
        return;
      }

      if (skipNextSelectedLoadKeyRef.current === selectedEntry.key) {
        skipNextSelectedLoadKeyRef.current = "";
        setSelectedLoading(false);
        setSelectedError("");
        return;
      }

      setSelectedLoading(true);
      setSelectedError("");

      try {
        if (selectedEntry.sourceType === "manual") {
          if (!selectedEntry.id) {
            throw new Error("Document not found.");
          }
          const manualDocument = await fetchSavedDocumentById(selectedEntry.id);
          if (!cancelled) {
            const resolvedDocument = finalizeWorkingDocument(manualDocument);
            const restoredDraft = readInvoiceDraft(selectedEntry.key);
            const draftDocument = restoredDraft
              ? finalizeWorkingDocument(restoredDraft, resolvedDocument)
              : null;
            lastPersistedPayloadRef.current = JSON.stringify(buildStoredPayload(resolvedDocument));
            latestDraftPayloadRef.current = JSON.stringify(
              buildStoredPayload(draftDocument || resolvedDocument)
            );
            setSelectedDocument(draftDocument || resolvedDocument);
          }
          return;
        }

        const savedOverride = selectedEntry.id ? await fetchSavedDocumentById(selectedEntry.id) : null;
        const payload = selectedEntry.sourceType === "bookings"
          ? await fetchBookingInvoiceDetails(selectedEntry.sourceId)
          : await fetchOrderInvoiceDetails(selectedEntry.sourceId);

        let baseDocument = null;
        if (selectedEntry.sourceType === "bookings") {
          const fallbackItems = bookings.find((item) => item.id === selectedEntry.sourceId)?.items || [];
          baseDocument = normalizeBookingDocument(payload, fallbackItems, defaultTaxRate);
        } else {
          const fallbackItems = orders.find((item) => item.id === selectedEntry.sourceId)?.items || [];
          baseDocument = normalizeOrderDocument(payload, fallbackItems, defaultTaxRate);
        }

        const override = savedOverride || savedLinkedMap.get(selectedEntry.key) || null;
        const merged = finalizeWorkingDocument(mergeDocument(baseDocument, override), baseDocument);
        if (!cancelled) {
          const restoredDraft = readInvoiceDraft(selectedEntry.key);
          const draftDocument = restoredDraft
            ? finalizeWorkingDocument(mergeDocument(merged, restoredDraft), merged)
            : null;
          lastPersistedPayloadRef.current = JSON.stringify(buildStoredPayload(merged));
          latestDraftPayloadRef.current = JSON.stringify(
            buildStoredPayload(draftDocument || merged)
          );
          setSelectedDocument(draftDocument || merged);
        }
      } catch (err) {
        console.error("Selected document load failed", err);
        if (!cancelled) {
          setSelectedError(err.message || "Unable to load document.");
          setSelectedDocument(null);
        }
      } finally {
        if (!cancelled) {
          setSelectedLoading(false);
        }
      }
    };

    loadSelectedDocument();
    return () => {
      cancelled = true;
    };
  }, [
    bookings,
    defaultTaxRate,
    fetchSavedDocumentById,
    finalizeWorkingDocument,
    orders,
    savedLinkedMap,
    selectedEntry,
  ]);

  const activeDocument = selectedDocument;

  useEffect(() => {
    if (!editorOpen || productsLoading) return;
    setSelectedDocument((current) => {
      if (!current) return current;
      const finalized = finalizeWorkingDocument(current, current);
      const currentPayload = JSON.stringify(buildStoredPayload(current));
      const nextPayload = JSON.stringify(buildStoredPayload(finalized));
      return currentPayload === nextPayload ? current : finalized;
    });
  }, [editorOpen, finalizeWorkingDocument, productsLoading]);

  useEffect(() => {
    if (!editorOpen || !selectedKey || !activeDocument) return;
    const payloadString = JSON.stringify(buildStoredPayload(activeDocument));
    latestDraftPayloadRef.current = payloadString;
    writeInvoiceDraft(selectedKey, activeDocument);
  }, [activeDocument, editorOpen, selectedKey]);

  useEffect(() => {
    if (!editorOpen || !selectedKey || !activeDocument || selectedLoading || selectedError) return;
    if (savingDocument || archivingDocument) return;
    const payloadString = JSON.stringify(buildStoredPayload(activeDocument));
    latestDraftPayloadRef.current = payloadString;
    if (payloadString === lastPersistedPayloadRef.current) return;
    window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      persistDocument(activeDocument, { autosave: true, documentKey: selectedKey });
    }, 2000);
    return () => {
      window.clearTimeout(autosaveTimerRef.current);
    };
  }, [
    activeDocument,
    archivingDocument,
    editorOpen,
    persistDocument,
    savingDocument,
    selectedError,
    selectedKey,
    selectedLoading,
  ]);

  useEffect(
    () => () => {
      window.clearTimeout(autosaveTimerRef.current);
    },
    []
  );

  const selectedEntryIndex = useMemo(
    () => visibleEntries.findIndex((entry) => entry.key === selectedKey),
    [selectedKey, visibleEntries]
  );
  const documentPagerLabel = useMemo(() => {
    if (!visibleEntries.length) return "0 of 0";
    return `${Math.max(0, selectedEntryIndex) + 1} of ${visibleEntries.length}`;
  }, [selectedEntryIndex, visibleEntries.length]);
  const selectedInvoiceCustomer = useMemo(() => {
    const customerId = Number(activeDocument?.customerId);
    if (!Number.isFinite(customerId) || customerId <= 0) return null;
    return customerById.get(customerId) || null;
  }, [activeDocument?.customerId, customerById]);
  const deferredInvoiceCustomerQuery = useDeferredValue(activeDocument?.customer?.name || "");
  const filteredInvoiceCustomerOptions = useMemo(() => {
    if (!customers.length) return [];
    const nameQuery = normalizeCustomerName(deferredInvoiceCustomerQuery);
    const phoneQuery = String(activeDocument?.customer?.name || "")
      .replace(/\D/g, "")
      .trim();
    const source =
      nameQuery || phoneQuery
        ? customers.filter((customer) => {
            const matchesName = normalizeCustomerName(customer.name).includes(nameQuery);
            const matchesPhone = phoneQuery
              ? String(customer.phone || "").replace(/\D/g, "").includes(phoneQuery)
              : false;
            const matchesEmail = nameQuery
              ? String(customer.email || "").toLowerCase().includes(nameQuery)
              : false;
            return matchesName || matchesPhone || matchesEmail;
          })
        : customers;
    return source.slice(0, nameQuery || phoneQuery ? 12 : 8);
  }, [activeDocument?.customer?.name, customers, deferredInvoiceCustomerQuery]);

  const summaryCards = useMemo(() => {
    const total = visibleEntries.reduce((sum, entry) => sum + toNumber(entry.total, 0), 0);
    const paid = visibleEntries.filter((entry) => entry.paymentStatus === "paid").length;
    const open = visibleEntries.filter((entry) => entry.paymentStatus !== "paid").length;
    return { total, paid, open, count: visibleEntries.length };
  }, [visibleEntries]);

  const handleDocumentChange = useCallback((updater) => {
    setSaveError("");
    setSaveStatus("");
    setSelectedDocument((current) => {
      if (!current) return current;
      const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
      return finalizeWorkingDocument(next, current);
    });
  }, [finalizeWorkingDocument]);

  const handleCustomerChange = (field, value) => {
    handleDocumentChange((current) => ({
      ...current,
      customer: {
        ...current.customer,
        [field]: value,
      },
    }));
  };

  const handleInvoiceCustomerSelection = (nextValue) => {
    const customerId = Number(nextValue);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      handleDocumentChange({ customerId: null });
      return;
    }
    const customer = customerById.get(customerId);
    handleDocumentChange((current) => ({
      ...current,
      customerId,
      customer: {
        ...current.customer,
        name: customer?.name || current.customer?.name || "",
        phone: customer?.phone || current.customer?.phone || "",
        email: customer?.email || current.customer?.email || "",
      },
    }));
    setInvoiceCustomerMenuOpen(false);
  };

  const handleInvoiceCustomerInputChange = (nextValue) => {
    setInvoiceCustomerMenuOpen(true);
    handleDocumentChange((current) => {
      const normalizedValue = normalizeCustomerName(nextValue);
      const normalizedSelectedName = normalizeCustomerName(selectedInvoiceCustomer?.name);
      const keepLinkedCustomer = normalizedValue && normalizedValue === normalizedSelectedName;
      const selectedPhone = String(selectedInvoiceCustomer?.phone || "").trim();
      const selectedEmail = String(selectedInvoiceCustomer?.email || "").trim().toLowerCase();
      const currentPhone = String(current.customer?.phone || "").trim();
      const currentEmail = String(current.customer?.email || "").trim().toLowerCase();

      return {
        ...current,
        customerId: keepLinkedCustomer ? current.customerId : null,
        customer: {
          ...current.customer,
          name: nextValue,
          phone: !keepLinkedCustomer && current.customerId && selectedPhone && currentPhone === selectedPhone ? "" : current.customer?.phone || "",
          email: !keepLinkedCustomer && current.customerId && selectedEmail && currentEmail === selectedEmail ? "" : current.customer?.email || "",
        },
      };
    });
  };

  const commitInvoiceCustomerInput = () => {
    const typedName = String(activeDocument?.customer?.name || "").trim();
    if (!typedName) {
      handleDocumentChange((current) => ({
        ...current,
        customerId: null,
        customer: {
          ...current.customer,
          name: "",
          phone: "",
          email: "",
        },
      }));
      setInvoiceCustomerMenuOpen(false);
      return;
    }
    const normalizedName = normalizeCustomerName(typedName);
    const matchedCustomer =
      customers.find((customer) => normalizeCustomerName(customer.name) === normalizedName) || null;
    if (matchedCustomer?.id) {
      handleInvoiceCustomerSelection(String(matchedCustomer.id));
      return;
    }
    handleDocumentChange({ customerId: null });
    setInvoiceCustomerMenuOpen(false);
  };

  const handleInvoiceCustomerInputKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitInvoiceCustomerInput();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setInvoiceCustomerMenuOpen(false);
    }
  };

  const handleEventChange = (field, value) => {
    handleDocumentChange((current) => ({
      ...current,
      event: {
        ...current.event,
        [field]: value,
      },
    }));
  };

  const handleLineItemChange = (itemId, field, value) => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) =>
        item.id === itemId
          ? (() => {
              if (field !== "quantity") {
                return {
                  ...item,
                  [field]: value,
                };
              }
              const requestedQuantity = normalizeLineQuantity(value, 0);
              const maxQuantity = resolveLineItemMaxQuantity(current, item, productById);
              return {
                ...item,
                quantity: maxQuantity == null ? requestedQuantity : Math.min(requestedQuantity, maxQuantity),
              };
            })()
          : item
      ),
    }));
  };

  const handleLineItemDescriptionChange = (itemId, value, rowType = "item") => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              name: value,
              productId: rowType === "item" ? null : item.productId,
              unitLabel: rowType === "item" ? DEFAULT_LINE_ITEM_UNIT : item.unitLabel,
              unitPrice: rowType === "item" ? 0 : item.unitPrice,
            }
          : item
      ),
    }));
  };

  const handleLineItemSelectProduct = (itemId, product) => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: current.lineItems.map((item) =>
        item.id === itemId
          ? (() => {
              const nextProductId = Number(product?.id) || null;
              const hasChangedProduct = nextProductId !== (Number(item?.productId) || null);
              const nextBaseItem = {
                ...item,
                rowType: "item",
                productId: nextProductId,
                name: product?.name || item.name,
                unitLabel: resolveProductUnitLabel(product),
                unitPrice: Math.max(0, toNumber(product?.price, item.unitPrice)),
              };
              const draftDocument = {
                ...current,
                lineItems: current.lineItems.map((line) =>
                  line.id === itemId
                    ? {
                        ...nextBaseItem,
                        quantity: hasChangedProduct ? 0 : item.quantity,
                      }
                    : line
                ),
              };
              const selectableStock = resolveProductRemainingStock(
                draftDocument,
                {
                  ...nextBaseItem,
                  quantity: hasChangedProduct ? 0 : item.quantity,
                },
                product
              );
              const maxQuantity = resolveLineItemMaxQuantity(
                draftDocument,
                {
                  ...nextBaseItem,
                  quantity: hasChangedProduct ? 0 : item.quantity,
                },
                productById
              );
              return {
                ...nextBaseItem,
                quantity: hasChangedProduct
                  ? selectableStock && selectableStock > 0
                    ? 1
                    : 0
                  : maxQuantity == null
                    ? normalizeLineQuantity(item.quantity, 0)
                    : Math.min(normalizeLineQuantity(item.quantity, 0), maxQuantity),
              };
            })()
          : item
      ),
    }));
  };

  const handleAddLineItem = (afterItemId = null) => {
    handleDocumentChange((current) => {
      const nextItem = createLineItem();
      if (!afterItemId) {
        return {
          ...current,
          lineItems: [...current.lineItems, nextItem],
        };
      }

      const currentItems = Array.isArray(current.lineItems) ? current.lineItems : [];
      const insertIndex = currentItems.findIndex((item) => item.id === afterItemId);
      if (insertIndex < 0) {
        return {
          ...current,
          lineItems: [...currentItems, nextItem],
        };
      }

      return {
        ...current,
        lineItems: [
          ...currentItems.slice(0, insertIndex + 1),
          nextItem,
          ...currentItems.slice(insertIndex + 1),
        ],
      };
    });
  };

  const handleAddHeadingLine = () => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: [...current.lineItems, createHeadingLine()],
    }));
  };

  const handleAddNoteLine = () => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: [...current.lineItems, createNoteLine()],
    }));
  };

  const handleMoveLineItem = (itemId, targetItemId) => {
    handleDocumentChange((current) => {
      const currentItems = Array.isArray(current.lineItems) ? [...current.lineItems] : [];
      const sourceIndex = currentItems.findIndex((item) => item.id === itemId);
      const targetIndex = currentItems.findIndex((item) => item.id === targetItemId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
      const [movedItem] = currentItems.splice(sourceIndex, 1);
      const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
      currentItems.splice(insertIndex, 0, movedItem);
      return {
        ...current,
        lineItems: currentItems,
      };
    });
  };

  const handleRemoveLineItem = (itemId) => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: current.lineItems.filter((item) => item.id !== itemId),
    }));
  };

  const handleAdditionalItemChange = (itemId, field, value) => {
    handleDocumentChange((current) => ({
      ...current,
      additionalItems: (current.additionalItems || []).map((item) =>
        item.id === itemId ? { ...item, [field]: field === "quantity" || field === "unitPrice" ? toNumber(value, 0) : value } : item
      ),
    }));
  };

  const handleAddAdditionalItem = () => {
    handleDocumentChange((current) => ({
      ...current,
      additionalItems: [...(current.additionalItems || []), createAdditionalItem()],
    }));
  };

  const handleRemoveAdditionalItem = (itemId) => {
    handleDocumentChange((current) => ({
      ...current,
      additionalItems: (current.additionalItems || []).filter((item) => item.id !== itemId),
    }));
  };

  const closeEditorModal = useCallback(() => {
    setEditorOpen(false);
    setSelectedLoading(false);
    setSelectedError("");
  }, []);

  const handleSelectEntry = useCallback((entryKey) => {
    if (currentSelectedKeyRef.current === entryKey && editorOpen) return;
    setSaveError("");
    setSaveStatus("");
    setSelectedError("");
    setSelectedDocument(null);
    setSelectedLoading(true);
    setEditorOpen(true);
    setSelectedKey(entryKey);
  }, [editorOpen]);

  const handleEntryKeyDown = useCallback((event, entryKey) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectEntry(entryKey);
    }
  }, [handleSelectEntry]);

  const handleDocumentPager = useCallback(
    (direction) => {
      const nextIndex = selectedEntryIndex + direction;
      if (nextIndex < 0 || nextIndex >= visibleEntries.length) return;
      const nextEntry = visibleEntries[nextIndex];
      if (!nextEntry?.key) return;
      handleSelectEntry(nextEntry.key);
    },
    [handleSelectEntry, selectedEntryIndex, visibleEntries]
  );

  const createDraftDocument = async (documentType) => {
    setCreatingDocument(documentType);
    setSaveError("");
    setSaveStatus("");
    try {
      const draft = buildEmptyDocument(documentType, defaultTaxRate);
      const response = await fetch("/.netlify/functions/invoice-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildStoredPayload(draft)),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to create document."));
      }
      const data = await response.json();
      const saved = normalizeSavedDocumentRecord(data);
      const entryKey = buildEntryKey("manual", null, saved.id);
      upsertSavedDocument(saved);
      setDocumentFilter("all");
      openDocumentEditor(entryKey, saved, { saveMessage: "Draft created." });
    } catch (err) {
      console.error("Create draft document failed", err);
      setSaveError(err.message || "Failed to create document.");
    } finally {
      setCreatingDocument("");
    }
  };

  const saveSelectedDocument = async () => {
    if (!activeDocument) return;
    window.clearTimeout(autosaveTimerRef.current);
    await persistDocument(activeDocument, { documentKey: selectedKey });
  };

  const createPdfDoc = async () => {
    if (!activeDocument) return null;
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const document = activeDocument;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const contentWidth = pageWidth - margin * 2;
    const currency = config.currency || "GHS";

    // ─── Colour palette ───────────────────────────────────────────────
    const navy      = [15,  23,  42];   // header band bg / table heads
    const slate     = [71,  85, 105];   // secondary text / subheadings
    const silver    = [241, 245, 249];  // alternating row / totals bg
    const divider   = [203, 213, 225];  // horizontal rules
    const white     = [255, 255, 255];
    const accent    = [251, 191,  36];  // amber accent — status pill

    // ─── Helper: draw a thin horizontal rule ──────────────────────────
    const hRule = (y, color = divider) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
    };
    const footerY = pageHeight - 10;
    const contentBottomY = footerY - 7;
    const renderFooter = () => {
      hRule(footerY - 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...slate);
      doc.text(config.storeName || COMPANY.name, margin, footerY);
      doc.text(config.storeEmail || COMPANY.email, pageWidth / 2, footerY, { align: "center" });
      doc.text(config.storePhone || COMPANY.phone, pageWidth - margin, footerY, { align: "right" });
    };
    const reservePageSpace = (startY, requiredHeight, resetY = margin) => {
      if (startY + requiredHeight <= contentBottomY) return startY;
      renderFooter();
      doc.addPage();
      return resetY;
    };
    const measureTextHeight = (text, width, fontSize, lineHeight) => {
      if (!text) return 0;
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, width);
      return lines.length * lineHeight;
    };

    // ─── HEADER BAND ─────────────────────────────────────────────────
    // Full-width navy band at the very top
    const bandH = 42;
    doc.setFillColor(...navy);
    doc.rect(0, 0, pageWidth, bandH, "F");

    // Left column: logo (stacked above company text), full-width proportional
    const logoColW   = 52;   // width reserved for the logo block
    const logoPad    = 6;    // padding inside band
    const logoMaxW   = logoColW - logoPad * 2;
    const logoMaxH   = 18;
    let   logoH      = 0;
    let   logoLoaded = false;

    try {
      const logoData = await getCompanyLogoData();

      const imgProps = doc.getImageProperties(logoData);
      const widthScale = logoMaxW / imgProps.width;
      const heightScale = logoMaxH / imgProps.height;
      const scale = Math.min(widthScale, heightScale);
      const drawW = imgProps.width * scale;
      const drawH = imgProps.height * scale;
      const logoX = logoPad + (logoMaxW - drawW) / 2;
      const logoY = logoPad + (logoMaxH - drawH) / 2;

      doc.addImage(logoData, "PNG", logoX, logoY, drawW, drawH);
      logoH      = drawH;
      logoLoaded = true;
    } catch (err) {
      console.warn("Logo load failed", err);
    }

    // Company name + details stacked below logo (or at top if no logo)
    const companyTextX = logoPad;
    let   companyTextY = logoLoaded ? logoPad + logoH + 3 : logoPad + 5;

    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(config.storeName || COMPANY.name, companyTextX, companyTextY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225); // lighter for sub-info
    const companyLines = [
      config.storeAddress || COMPANY.location,
      config.storePhone   || COMPANY.phone,
      config.storeEmail   || COMPANY.email,
    ].filter(Boolean);
    companyLines.forEach((line, i) => {
      doc.text(line, companyTextX, companyTextY + 4.5 + i * 4);
    });

    // Right column: document type + number + dates
    const documentNumber = getDocumentNumberValue(document.invoiceNumber);
    const rightX = pageWidth - margin;

    doc.setTextColor(...white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    const typeLabel = documentNumber ? document.docLabel.toUpperCase() : "DRAFT";
    doc.text(typeLabel, rightX, logoPad + 10, { align: "right" });

    if (documentNumber) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(203, 213, 225);
      doc.text(`#${documentNumber}`, rightX, logoPad + 16, { align: "right" });
    }

    // Status pill (amber badge)
    const status = String(document.paymentStatus || "draft").toUpperCase();
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    const pillW = 20, pillH = 5.5, pillX = rightX - pillW, pillY = logoPad + 19;
    const pillColor = status === "PAID" ? [34, 197, 94] : status === "DRAFT" ? [148, 163, 184] : accent;
    doc.setFillColor(...pillColor);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.2, 1.2, "F");
    doc.setTextColor(...(status === "PAID" ? white : navy));
    doc.text(status, pillX + pillW / 2, pillY + 3.8, { align: "center" });

    // Date and due date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Issued: ${formatShortDate(document.issueDate)}`, rightX, logoPad + 29, { align: "right" });
    if (document.dueDate) {
      doc.text(
        `${getInvoiceDueDateSummaryLabel(document)}: ${formatShortDate(document.dueDate)}`,
        rightX,
        logoPad + 34,
        { align: "right" }
      );
    }

    // ─── BILL TO + EVENT ─────────────────────────────────────────────
    let cursorY = bandH + 10;
    doc.setTextColor(...slate);

    // "BILL TO" label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...slate);
    doc.text("BILL TO", margin, cursorY);

    // Customer details
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...navy);
    cursorY += 5;
    doc.text(document.customer?.name || "—", margin, cursorY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...slate);
    const contactLines = [document.customer?.phone, document.customer?.email].filter(Boolean);
    contactLines.forEach((line) => {
      cursorY += 4.5;
      doc.text(String(line), margin, cursorY);
    });

    // Event details (right column, same band)
    const hasEvent = document.event?.eventDate || document.event?.venueAddress;
    if (hasEvent) {
      const eventX = margin + contentWidth * 0.5;
      let eventY   = bandH + 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...slate);
      doc.text("EVENT", eventX, eventY);

      eventY += 5;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...navy);
      doc.text(formatShortDate(document.event.eventDate), eventX, eventY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...slate);

      const timeStr = [document.event?.startTime, document.event?.endTime]
        .filter(Boolean)
        .join(" – ");
      if (timeStr) {
        eventY += 4.5;
        doc.text(timeStr, eventX, eventY);
      }
      if (document.event?.venueAddress) {
        eventY += 4.5;
        const wrappedVenue = doc.splitTextToSize(document.event.venueAddress, contentWidth * 0.48);
        doc.text(wrappedVenue, eventX, eventY);
        const extraLines = wrappedVenue.length - 1;
        cursorY = Math.max(cursorY, eventY + extraLines * 4);
      } else {
        cursorY = Math.max(cursorY, eventY);
      }
    }

    cursorY += 8;
    hRule(cursorY);
    cursorY += 8;

    // ─── ITEMS TABLE ─────────────────────────────────────────────────
    const tableStyles = {
      fontSize: 9,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      font: "helvetica",
      textColor: navy,
    };
    const headStyles = {
      fillColor: navy,
      textColor: white,
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: { top: 5, bottom: 5, left: 4, right: 4 },
    };
    const colStyles = {
      0: { cellWidth: "auto" },                          // Description — flexible
      1: { cellWidth: 14, halign: "center" },            // Qty
      2: { cellWidth: 22, halign: "center" },            // Unit
      3: { cellWidth: 30, halign: "right" },             // Price
      4: { cellWidth: 30, halign: "right" },             // Total
    };

    const body = document.lineItems.map((item) =>
      isHeadingLineItem(item)
        ? [{
            content: item.name || "Section",
            colSpan: 5,
            styles: { fontStyle: "bold", fillColor: silver, textColor: navy, fontSize: 8.5 },
          }]
        : isNoteLineItem(item)
          ? [{
              content: item.name || "",
              colSpan: 5,
              styles: { fontStyle: "italic", fontSize: 8, textColor: slate },
            }]
          : [
              item.name || "",
              { content: String(item.quantity || 0), styles: { halign: "center" } },
              { content: item.unitLabel || DEFAULT_LINE_ITEM_UNIT, styles: { halign: "center" } },
              { content: formatPdfCurrency(item.unitPrice || 0, currency), styles: { halign: "right" } },
              { content: formatPdfCurrency(item.total    || 0, currency), styles: { halign: "right" } },
            ]
    );

    const runTable = (cfg) => {
      if (typeof doc.autoTable === "function") doc.autoTable(cfg);
      else autoTable(doc, cfg);
      return doc.lastAutoTable?.finalY ?? cfg.startY + 20;
    };

    let tableEndY = runTable({
      startY: cursorY,
      head: [["Description", "Qty", "Unit", "Price", "Total"]],
      body,
      styles: tableStyles,
      headStyles,
      columnStyles: colStyles,
      alternateRowStyles: { fillColor: silver },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
    });

    // ─── EXPENSES TABLE (conditional) ────────────────────────────────
    const additionalItems = normalizeAdditionalItems(document.additionalItems);

    if (additionalItems.length > 0) {
      // Small section label above the table
      tableEndY += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...slate);
      doc.text("ADDITIONAL ITEMS", margin, tableEndY);
      tableEndY += 4;

      const expensesColStyles = {
        0: { cellWidth: "auto" },
        1: { cellWidth: 14, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 30, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
      };

      tableEndY = runTable({
        startY: tableEndY,
        head: [["Description", "Qty", "Unit", "Price", "Total"]],
        body: additionalItems.map((item) => [
          item.description || "",
          { content: String(item.quantity || 0),  styles: { halign: "center" } },
          { content: item.unitLabel || DEFAULT_LINE_ITEM_UNIT, styles: { halign: "center" } },
          { content: formatPdfCurrency(item.unitPrice || 0, currency), styles: { halign: "right" } },
          { content: formatPdfCurrency(item.total    || 0, currency), styles: { halign: "right" } },
        ]),
        styles: { ...tableStyles, fontSize: 8.5 },
        headStyles: { ...headStyles, fillColor: slate },
        columnStyles: expensesColStyles,
        alternateRowStyles: { fillColor: silver },
        margin: { left: margin, right: margin },
        tableWidth: contentWidth,
      });
    }

    // ─── TOTALS BOX ───────────────────────────────────────────────────
    const hasTax      = (document.summary.taxRate      || 0) > 0;
    const hasDiscount = (document.summary.discountTotal || 0) > 0;
    const hasExpenses = (document.summary.additionalTotal || 0) > 0;
    const isInvoice   = document.documentType === "invoice";
    const isFullPaymentDue = Boolean(document.summary.fullPaymentDue);
    const notesText = document.notes?.trim() || "";
    const termsText = document.terms?.trim() || "";
    const hasNotes = Boolean(notesText || termsText);

    const rowH = 7;
    let totalsRows = 2; // subtotal + grand total
    if (hasExpenses)  totalsRows += 1;
    if (hasTax)       totalsRows += 1;
    if (isInvoice)    totalsRows += isFullPaymentDue ? 1 : 2; // due amount + optional balance due
    if (isInvoice && hasDiscount) totalsRows += 1;

    const boxW  = 80;
    const boxH  = totalsRows * rowH + 14; // extra padding top/bottom
    const boxX  = pageWidth - margin - boxW;
    let   boxY  = reservePageSpace(tableEndY + 8, boxH + 4, margin + 8);

    // Light fill
    doc.setFillColor(...silver);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...slate);

    let ry = boxY + 8; // first row baseline
    const labelX  = boxX + 6;
    const valueX  = boxX + boxW - 6;

    const totalsRow = (label, value, opts = {}) => {
      if (opts.bold) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...navy);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...slate);
      }
      doc.setFontSize(opts.large ? 9.5 : 8.5);
      doc.text(label, labelX, ry);
      doc.text(value, valueX, ry, { align: "right" });
      ry += rowH;
    };

    totalsRow("Subtotal", formatPdfCurrency(document.summary.subtotal, currency));
    if (hasExpenses) totalsRow("Expenses", formatPdfCurrency(document.summary.additionalTotal, currency));
    if (hasTax)      totalsRow(`Tax (${(document.summary.taxRate * 100).toFixed(0)}%)`, formatPdfCurrency(document.summary.taxTotal, currency));

    // Divider above Grand Total
    doc.setDrawColor(...divider);
    doc.setLineWidth(0.3);
    doc.line(boxX + 4, ry - 3, boxX + boxW - 4, ry - 3);

    totalsRow("Grand Total", formatPdfCurrency(document.summary.grandTotal, currency), { bold: true, large: true });

    if (isInvoice) {
      totalsRow(getInvoiceDepositLabel(document), formatPdfCurrency(document.summary.depositAmount, currency));
      if (hasDiscount) totalsRow("Discount", `-${formatPdfCurrency(document.summary.discountTotal, currency)}`);

      if (!document.summary.fullPaymentDue) {
        // Divider above Balance Due
        doc.setDrawColor(...divider);
        doc.line(boxX + 4, ry - 3, boxX + boxW - 4, ry - 3);

        totalsRow(
          getInvoiceBalanceLabel(),
          formatPdfCurrency(document.summary.balanceDue, currency),
          { bold: true, large: true }
        );
      }
    } else {
      totalsRow("Amount Paid", formatPdfCurrency(document.summary.amountPaid, currency), { bold: true });
    }

    // ─── NOTES & TERMS ────────────────────────────────────────────────
    if (hasNotes) {
      const notesWidth = contentWidth * 0.65;
      const estimatedNotesHeight =
        8 +
        (notesText ? 9.5 + measureTextHeight(notesText, notesWidth, 8, 4) : 0) +
        (termsText ? 9.5 + measureTextHeight(termsText, notesWidth, 7.5, 3.8) : 0);
      let notesY = reservePageSpace(boxY + boxH + 10, estimatedNotesHeight, margin + 8);

      // Light band
      doc.setFillColor(...silver);
      doc.rect(margin, notesY - 4, contentWidth, 4, "F"); // top strip
      hRule(notesY - 4, divider);

      let ny = notesY + 4;

      if (notesText) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...slate);
        doc.text("NOTE", margin, ny);
        ny += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...navy);
        const wrappedNote = doc.splitTextToSize(notesText, notesWidth);
        doc.text(wrappedNote, margin, ny);
        ny += wrappedNote.length * 4 + 4;
      }

      if (termsText) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...slate);
        doc.text("TERMS & CONDITIONS", margin, ny);
        ny += 4.5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...slate);
        const wrappedTerms = doc.splitTextToSize(termsText, notesWidth);
        doc.text(wrappedTerms, margin, ny);
      }
    }

    // ─── PAGE FOOTER ─────────────────────────────────────────────────
    renderFooter();

    return doc;
  };

  const buildPdf = async () => {
    if (!activeDocument) return;
    setPdfLoading(true);
    setSaveError("");
    try {
      const doc = await createPdfDoc();
      if (!doc) return;
      doc.save(`${getDocumentFileLabel(activeDocument)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed", err);
      setSaveError("Failed to generate PDF.");
    } finally {
      setPdfLoading(false);
    }
  };

  const saveToDocuments = async () => {
    if (!activeDocument) return;
    setSavingPdfDocument(true);
    setSaveError("");
    setSaveStatus("");
    try {
      const doc = await createPdfDoc();
      if (!doc) return;
      const dataUri = doc.output("datauristring");
      const base64 = String(dataUri || "").split(",")[1] || "";
      if (!base64) {
        throw new Error("Unable to prepare PDF data.");
      }

      const fileLabel = getDocumentFileLabel(activeDocument);
      const response = await fetch("/.netlify/functions/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: getDocumentDisplayHeading(activeDocument),
          category: activeDocument.docLabel,
          fileName: `${fileLabel}.pdf`,
          mimeType: "application/pdf",
          data: base64,
          source: "generated",
        }),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to save PDF to Documents."));
      }
      setSaveStatus("Saved to Documents.");
    } catch (err) {
      console.error("Save to documents failed", err);
      setSaveError(err.message || "Failed to save PDF.");
    } finally {
      setSavingPdfDocument(false);
    }
  };

  const sendDocumentByEmail = async () => {
    if (!activeDocument) return;
    if (!activeDocument.customer?.email) {
      setSaveError("Add a customer email before sending.");
      setSaveStatus("");
      return;
    }

    setEmailingDocument(true);
    setSaveError("");
    setSaveStatus("");
    try {
      const sentAt = new Date().toISOString();
      const sentToEmail = activeDocument.customer?.email || "";
      const invoiceNumber = getDocumentNumberValue(activeDocument.invoiceNumber) || buildDocumentNumber(activeDocument.documentType);
      const paymentStatus = activeDocument.paymentStatus === "draft" ? "unpaid" : activeDocument.paymentStatus;
      const documentToSend = finalizeWorkingDocument({
        ...activeDocument,
        invoiceNumber,
        paymentStatus,
        sentAt,
        sentToEmail,
      }, activeDocument);
      const response = await fetch("/.netlify/functions/invoice-document-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: documentToSend.documentType,
          docLabel: documentToSend.docLabel,
          invoiceNumber: documentToSend.invoiceNumber,
          issueDate: documentToSend.issueDate,
          dueDate: documentToSend.dueDate,
          paymentStatus: documentToSend.paymentStatus,
          customerName: documentToSend.customer?.name || "",
          customerEmail: documentToSend.customer?.email || "",
          linkedLabel: documentToSend.linkedLabel || "",
          lineItems: documentToSend.lineItems,
          notes: documentToSend.notes || "",
          terms: documentToSend.terms || "",
          taxRate: documentToSend.taxRate,
          depositAmount: documentToSend.depositAmount,
          discountAmount: documentToSend.discountAmount,
          additionalItems: documentToSend.additionalItems,
          currency: config.currency,
        }),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to send document email."));
      }
      setSelectedDocument(documentToSend);
      const saved = await persistDocument(documentToSend, { documentKey: selectedKey });
      if (!saved) {
        setSaveError("Email sent, but the sent banner could not be saved yet.");
      }
      setSaveStatus(`Sent to ${documentToSend.customer.email}.`);
    } catch (err) {
      console.error("Send document email failed", err);
      setSaveError(err.message || "Failed to send document email.");
    } finally {
      setEmailingDocument(false);
    }
  };

  const archiveDocument = async (payload, label, { closeEditor = false } = {}) => {
    setArchivingDocument(true);
    setSaveError("");
    setSaveStatus("");
    try {
      const response = await fetch("/.netlify/functions/invoice-documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to archive document."));
      }
      const archived = normalizeSavedDocumentRecord(await response.json());
      upsertSavedDocument(archived);
      if (selectedKey && payload?.id && activeDocument?.id === payload.id) {
        setSelectedKey("");
      }
      if (
        selectedKey &&
        !payload?.id &&
        payload?.sourceType &&
        payload?.sourceId &&
        selectedKey === buildEntryKey(payload.sourceType, payload.sourceId)
      ) {
        setSelectedKey("");
      }
      await fetchProducts();
      if (closeEditor) {
        setSelectedDocument(null);
        setSelectedError("");
        setSelectedLoading(false);
        setEditorOpen(false);
      }
      setSaveStatus(`${label} archived.`);
    } catch (err) {
      console.error("Archive document failed", err);
      setSaveError(err.message || "Failed to archive document.");
    } finally {
      setArchivingDocument(false);
    }
  };

  const archiveSelectedDocument = async () => {
    if (!activeDocument) return;
    const label = getDocumentArchiveLabel(activeDocument);
    if (!window.confirm(`Archive ${label}?`)) return;
    await archiveDocument(
      {
        id: activeDocument.id,
        ...buildStoredPayload(activeDocument),
      },
      label,
      { closeEditor: true }
    );
  };

  const archiveEntryFromList = async (entry, event) => {
    event.preventDefault();
    event.stopPropagation();
    const label = getDocumentArchiveLabel(entry);
    if (!window.confirm(`Archive ${label}?`)) return;

    await archiveDocument(
      {
        id: entry.id || null,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        documentType: entry.documentType,
        title: label,
        invoiceNumber: entry.invoiceNumber,
        issueDate: entry.issueDate,
        paymentStatus: entry.paymentStatus,
        customerName: entry.customerName || "",
        customerEmail: "",
        customerPhone: "",
        lineItems: [],
        expenses: [],
        notes: "",
        terms: "",
        taxRate: 0,
        depositAmount: 0,
        discountAmount: 0,
      },
      label
    );
  };

  const workspaceError = selectedError || documentsError || ordersError || bookingsError;
  const documentTitle = selectedLoading ? "Opening document" : activeDocument ? getDocumentDisplayHeading(activeDocument) : "Document";
  const invoiceCustomerPickerProps = {
    value: activeDocument?.customer?.name || "",
    onChange: (event) => handleInvoiceCustomerInputChange(event.target.value),
    onClear: () => {
      handleDocumentChange((current) => ({
        ...current,
        customerId: null,
        customer: {
          ...current.customer,
          name: "",
          phone: "",
          email: "",
        },
      }));
      setInvoiceCustomerMenuOpen(false);
    },
    onFocus: () => setInvoiceCustomerMenuOpen(true),
    onBlur: () => {
      setTimeout(() => {
        setInvoiceCustomerMenuOpen(false);
      }, 120);
    },
    onKeyDown: handleInvoiceCustomerInputKeyDown,
    menuOpen: invoiceCustomerMenuOpen,
    options: filteredInvoiceCustomerOptions,
    selectedCustomerId: activeDocument?.customerId || "",
    onSelectCustomer: handleInvoiceCustomerSelection,
    selectedCustomer: selectedInvoiceCustomer,
    customerError,
  };

  if (editorOpen) {
    return (
      <div className="admin-page invoicing-page invoice-hub-page">
        <div className="admin-shell invoicing-shell invoice-document-shell">
          <AdminBreadcrumb items={[{ label: "Invoicing" }, { label: documentTitle }]} />

          <AdminPageHeader
            copyClassName="invoice-hub-copy"
            eyebrow={activeDocument?.sourceType === "manual" ? MANUAL_LINKED_NOTE : activeDocument?.linkedLabel || "Document"}
            title={documentTitle}
          >
            <div className="invoice-hub-header-actions">
                <button
                  type="button"
                  className="admin-secondary invoice-hub-action"
                  onClick={closeEditorModal}
                  aria-label="Back"
                  title="Back"
                >
                  <AppIcon icon={faArrowLeft} />
                  <span className="sr-only">Back</span>
                </button>
                <button
                  type="button"
                  className="admin-secondary invoice-hub-action"
                  onClick={saveSelectedDocument}
                  disabled={savingDocument || autosavingDocument || !activeDocument}
                  aria-label={savingDocument || autosavingDocument ? "Saving document" : "Save document"}
                  title={savingDocument || autosavingDocument ? "Saving document" : "Save document"}
                >
                  <AppIcon icon={faFloppyDisk} />
                  <span className="sr-only">
                    {savingDocument || autosavingDocument ? "Saving document" : "Save document"}
                  </span>
                </button>
                <button
                  type="button"
                  className="admin-secondary invoice-hub-action"
                  onClick={buildPdf}
                  disabled={pdfLoading || !activeDocument}
                  aria-label={pdfLoading ? "Preparing PDF" : "Build PDF"}
                  title={pdfLoading ? "Preparing PDF" : "Build PDF"}
                >
                  <AppIcon icon={faFilePdf} />
                  <span className="sr-only">{pdfLoading ? "Preparing PDF" : "Build PDF"}</span>
                </button>
                <button
                  type="button"
                  className="admin-secondary invoice-hub-action"
                  onClick={sendDocumentByEmail}
                  disabled={emailingDocument || !activeDocument || !activeDocument.customer?.email}
                  aria-label={emailingDocument ? "Sending to email" : "Send to email"}
                  title={
                    !activeDocument?.customer?.email
                      ? "Add customer email"
                      : emailingDocument
                        ? "Sending to email"
                        : "Send to email"
                  }
                >
                  <AppIcon icon={faEnvelope} />
                  <span className="sr-only">{emailingDocument ? "Sending to email" : "Send to email"}</span>
                </button>
                <button
                  type="button"
                  className="admin-secondary invoice-hub-action"
                  onClick={saveToDocuments}
                  disabled={savingPdfDocument || !activeDocument}
                  aria-label={savingPdfDocument ? "Saving to documents" : "Save to documents"}
                  title={savingPdfDocument ? "Saving to documents" : "Save to documents"}
                >
                  <AppIcon icon={faFolderOpen} />
                  <span className="sr-only">
                    {savingPdfDocument ? "Saving to documents" : "Save to documents"}
                  </span>
                </button>
                <button
                  type="button"
                  className="admin-secondary invoice-hub-action invoice-hub-action-danger"
                  onClick={archiveSelectedDocument}
                  disabled={archivingDocument || !activeDocument}
                  aria-label={archivingDocument ? "Archiving document" : "Archive"}
                  title={archivingDocument ? "Archiving document" : "Archive"}
                >
                  <AppIcon icon={faBoxArchive} />
                  <span className="sr-only">{archivingDocument ? "Archiving document" : "Archive"}</span>
                </button>
                <button
                  type="button"
                  className="admin-secondary invoice-hub-action"
                  onClick={() => window.print()}
                  disabled={!activeDocument}
                  aria-label="Print"
                  title="Print"
                >
                  <AppIcon icon={faPrint} />
                  <span className="sr-only">Print</span>
                </button>
            </div>
          </AdminPageHeader>

          {saveError ? <p className="invoicing-error">{saveError}</p> : null}
          {saveStatus ? <p className="invoicing-success">{saveStatus}</p> : null}

          {selectedLoading ? (
            <div className="glass-card invoice-hub-empty">
              <h3>Loading document…</h3>
            </div>
          ) : selectedError ? (
            <div className="glass-card invoice-hub-empty">
              <h3>Unable to open document</h3>
              <p>{selectedError}</p>
            </div>
          ) : !activeDocument ? (
            <div className="glass-card invoice-hub-empty">
              <h3>No document selected</h3>
            </div>
          ) : (
            <div className="invoice-document-layout">
              <section className={`glass-card invoice-hub-editor${activeDocument.sentAt ? " invoice-hub-editor--sent" : ""}`}>
                <DocumentSentBanner sentAt={activeDocument.sentAt} />
                <div className="invoice-hub-editor-head">
                  <div>
                    <p className="invoicing-label">Builder</p>
                    <h2>{getDocumentDisplayHeading(activeDocument)}</h2>
                  </div>
                  <DocumentPill value={activeDocument.paymentStatus} />
                </div>
                <div className="invoice-document-pagination" aria-label="Document pagination">
                  <div className="invoice-document-pagination-nav">
                    <button
                      type="button"
                      className="admin-secondary invoice-document-pagination-button"
                      onClick={() => handleDocumentPager(-1)}
                      disabled={selectedEntryIndex <= 0}
                      aria-label="Previous document"
                      title="Previous document"
                    >
                      <AppIcon icon={faChevronLeft} />
                    </button>
                    <button
                      type="button"
                      className="admin-secondary invoice-document-pagination-button"
                      onClick={() => handleDocumentPager(1)}
                      disabled={selectedEntryIndex < 0 || selectedEntryIndex >= visibleEntries.length - 1}
                      aria-label="Next document"
                      title="Next document"
                    >
                      <AppIcon icon={faChevronRight} />
                    </button>
                  </div>
                  <strong className="invoice-document-pagination-label">{documentPagerLabel}</strong>
                </div>
                <EditableDocumentTemplate
                  document={activeDocument}
                  companyConfig={config}
                  onDocumentChange={handleDocumentChange}
                  onCustomerChange={handleCustomerChange}
                  customerPickerProps={invoiceCustomerPickerProps}
                  productOptions={products}
                  productById={productById}
                  productLoading={productsLoading}
                  productError={productError}
                  onEventChange={handleEventChange}
                  onLineItemChange={handleLineItemChange}
                  onLineItemDescriptionChange={handleLineItemDescriptionChange}
                  onLineItemSelectProduct={handleLineItemSelectProduct}
                  onAddLineItem={handleAddLineItem}
                  onAddHeadingLine={handleAddHeadingLine}
                  onAddNoteLine={handleAddNoteLine}
                  onMoveLineItem={handleMoveLineItem}
                  onRemoveLineItem={handleRemoveLineItem}
                  onAdditionalItemChange={handleAdditionalItemChange}
                  onAddAdditionalItem={handleAddAdditionalItem}
                  onRemoveAdditionalItem={handleRemoveAdditionalItem}
                />
              </section>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page invoicing-page invoice-hub-page">
      <div className="admin-shell invoicing-shell invoice-hub-shell">
        <AdminBreadcrumb items={[{ label: "Invoicing" }]} />

        <AdminPageHeader
          copyClassName="invoice-hub-copy"
          title="Invoicing"
        >
          <div className="invoice-hub-header-actions">
              <button
                type="button"
                className="admin-secondary invoice-hub-action"
                onClick={refreshAll}
                disabled={ordersLoading || bookingsLoading || documentsLoading}
                aria-label="Refresh"
                title="Refresh"
              >
                <AppIcon icon={faRotateRight} />
                <span className="sr-only">Refresh</span>
              </button>
              <button
                type="button"
                className="admin-secondary invoice-hub-action"
                onClick={() => createDraftDocument("receipt")}
                disabled={Boolean(creatingDocument)}
                aria-label={creatingDocument === "receipt" ? "Creating receipt" : "New receipt"}
                title={creatingDocument === "receipt" ? "Creating receipt" : "New receipt"}
              >
                <AppIcon icon={faReceipt} />
                <span className="sr-only">
                  {creatingDocument === "receipt" ? "Creating receipt" : "New receipt"}
                </span>
              </button>
              <button
                type="button"
                className="admin-primary invoice-hub-action"
                onClick={() => createDraftDocument("invoice")}
                disabled={Boolean(creatingDocument)}
                aria-label={creatingDocument === "invoice" ? "Creating invoice" : "New invoice"}
                title={creatingDocument === "invoice" ? "Creating invoice" : "New invoice"}
              >
                <AppIcon icon={faFileInvoice} />
                <span className="sr-only">
                  {creatingDocument === "invoice" ? "Creating invoice" : "New invoice"}
                </span>
              </button>
          </div>
        </AdminPageHeader>

        {saveError ? <p className="invoicing-error">{saveError}</p> : null}
        {saveStatus ? <p className="invoicing-success">{saveStatus}</p> : null}

        <InvoiceDocumentListSection
          config={config}
          summaryCards={summaryCards}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          documentFilter={documentFilter}
          setDocumentFilter={setDocumentFilter}
          paymentStatusFilter={paymentStatusFilter}
          setPaymentStatusFilter={setPaymentStatusFilter}
          documentTypeOptions={DOCUMENT_TYPE_FILTER_OPTIONS}
          paymentStatusOptions={PAYMENT_STATUS_FILTER_OPTIONS}
          ordersLoading={ordersLoading}
          bookingsLoading={bookingsLoading}
          documentsLoading={documentsLoading}
          workspaceError={workspaceError}
          visibleEntries={visibleEntries}
          selectedKey={selectedKey}
          handleSelectEntry={handleSelectEntry}
          handleEntryKeyDown={handleEntryKeyDown}
          getDocumentTableReference={getDocumentTableReference}
          formatShortDate={formatShortDate}
          formatCurrency={formatCurrency}
          archiveEntryFromList={archiveEntryFromList}
          archivingDocument={archivingDocument}
          getDocumentArchiveLabel={getDocumentArchiveLabel}
          DocumentPillComponent={DocumentPill}
        />
      </div>
    </div>
  );
}

export default AdminInvoicing;
