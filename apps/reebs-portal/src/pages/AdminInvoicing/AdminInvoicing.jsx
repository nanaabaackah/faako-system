import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminInvoicing.css";
import { AppIcon } from "/src/components/Icon/Icon";
import {
  faArrowLeft,
  faBoxArchive,
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminBreadcrumb from "../../components/AdminBreadcrumb/AdminBreadcrumb";
import AdminPageHeader from "../../components/AdminPageHeader/AdminPageHeader";
import SearchField from "../../components/SearchField/SearchField";

const COMPANY = {
  name: "REEBS Party Themes",
  location: "Sakumono Broadway, Tema, Ghana",
  phone: "+233 24 423 8419",
  email: "info@reebs.com",
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

const MANUAL_SOURCE_LABEL = "Invoicing";
const MANUAL_LINKED_LABEL = "Built here";
const MANUAL_LINKED_NOTE = "Built from template";

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

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const parseTaxRate = (value) => {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1 ? raw / 100 : raw;
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

const defaultTermsForType = (documentType) =>
  documentType === "receipt"
    ? "Returns or exchanges require the original receipt."
    : "Balance is due before delivery or pickup unless noted.";

const defaultNotesForType = (documentType) =>
  documentType === "receipt"
    ? "Thank you for your purchase."
    : "Thank you for your booking.";

const createLineItem = (overrides = {}) => ({
  id: overrides.id || `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: overrides.name || "",
  quantity: Math.max(0, toNumber(overrides.quantity, 1)),
  unitPrice: Math.max(0, toNumber(overrides.unitPrice, 0)),
  total: 0,
});

const normalizeLineItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => createLineItem(item))
    .map((item) => ({
      ...item,
      total: Number((item.quantity * item.unitPrice).toFixed(2)),
    }));
};

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

const buildEntryKey = (sourceType, sourceId, id = null) =>
  sourceType === "manual" ? `manual-${id}` : `${sourceType}-${sourceId}`;

const buildSourceLabel = (sourceType, sourceId) => {
  if (sourceType === "manual") return MANUAL_SOURCE_LABEL;
  if (sourceType === "bookings") return `Booking #${sourceId}`;
  return `Order #${sourceId}`;
};

const buildEmptyDocument = (documentType, taxRate = 0) => ({
  id: null,
  sourceType: "manual",
  sourceId: null,
  documentType,
  title: "",
  invoiceNumber: buildDocumentNumber(documentType),
  issueDate: todayValue(),
  paymentStatus: "draft",
  depositAmount: 0,
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
  lineItems: [createLineItem()],
  expenses: [],
  notes: defaultNotesForType(documentType),
  terms: defaultTermsForType(documentType),
  taxRate,
  docLabel: documentType === "receipt" ? "Receipt" : "Invoice",
  sourceLabel: MANUAL_SOURCE_LABEL,
  linkedLabel: MANUAL_LINKED_LABEL,
  createdAt: null,
  updatedAt: null,
});

const normalizeStoredDocument = (record) => {
  const documentType = record?.documentType === "receipt" ? "receipt" : "invoice";
  return {
    id: Number(record?.id) || null,
    sourceType: record?.sourceType || "manual",
    sourceId: Number(record?.sourceId) || null,
    documentType,
    title: String(record?.title || ""),
    invoiceNumber: String(record?.invoiceNumber || buildDocumentNumber(documentType)),
    issueDate: normalizeDateInput(record?.issueDate) || todayValue(),
    paymentStatus: String(record?.paymentStatus || "draft").toLowerCase(),
    depositAmount: Math.max(0, toNumber(record?.depositAmount, 0)),
    customer: {
      name: String(record?.customerName || ""),
      email: String(record?.customerEmail || ""),
      phone: String(record?.customerPhone || ""),
    },
    event: {
      eventDate: normalizeDateInput(record?.eventDate),
      startTime: String(record?.startTime || ""),
      endTime: String(record?.endTime || ""),
      venueAddress: String(record?.venueAddress || ""),
    },
    lineItems: normalizeLineItems(record?.lineItems),
    expenses: normalizeExpenses(record?.expenses),
    notes: String(record?.notes || ""),
    terms: String(record?.terms || ""),
    taxRate: parseTaxRate(record?.taxRate),
    docLabel: documentType === "receipt" ? "Receipt" : "Invoice",
    sourceLabel: buildSourceLabel(record?.sourceType, record?.sourceId, record?.title),
    linkedLabel:
      record?.sourceType === "manual"
        ? MANUAL_LINKED_LABEL
        : buildSourceLabel(record?.sourceType, record?.sourceId),
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
    documentType: "receipt",
    title: payload?.orderNumber ? `Receipt ${payload.orderNumber}` : "",
    invoiceNumber:
      payload?.invoiceNumber || (payload?.orderNumber ? `REC-${payload.orderNumber}` : buildDocumentNumber("receipt")),
    issueDate: normalizeDateInput(payload?.date || payload?.orderDate || payload?.createdAt) || todayValue(),
    paymentStatus: "unpaid",
    depositAmount: 0,
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
    lineItems: normalizeLineItems(
      items.map((item, index) => {
        const quantity = toNumber(item.quantity, 1);
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
          name: item.name || item.Product?.name || "Item",
          quantity,
          unitPrice: isCents ? unitPriceRaw / 100 : unitPriceRaw,
          total: isCents ? totalRaw / 100 : totalRaw,
        };
      })
    ),
    expenses: expenseInfo.expenses,
    notes: defaultNotesForType("receipt"),
    terms: defaultTermsForType("receipt"),
    taxRate: defaultTaxRate,
    docLabel: "Receipt",
    sourceLabel: "Order",
    linkedLabel: payload?.orderNumber ? `Order ${payload.orderNumber}` : `Order #${payload?.id || ""}`,
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
  return {
    id: null,
    sourceType: "bookings",
    sourceId: payload?.id || null,
    documentType: "invoice",
    title: payload?.id ? `Invoice Booking #${payload.id}` : "",
    invoiceNumber: payload?.invoiceNumber || `INV-${formatDateStamp(payload?.eventDate)}-${payload?.id}`,
    issueDate: normalizeDateInput(payload?.eventDate) || todayValue(),
    paymentStatus: "unpaid",
    depositAmount: Number((subtotal * 0.7).toFixed(2)),
    customer: {
      name: payload?.customerName || "Customer",
      email: payload?.customerEmail || "",
      phone: payload?.customerPhone || "",
    },
    event: {
      eventDate: normalizeDateInput(payload?.eventDate),
      startTime: payload?.startTime || "",
      endTime: payload?.endTime || "",
      venueAddress: payload?.venueAddress || "",
    },
    lineItems: normalizeLineItems(
      items.map((item, index) => ({
        id: item.id || `${item.productId || "item"}-${index}`,
        name: item.productName || item.name || "Item",
        quantity: toNumber(item.quantity, 1),
        unitPrice: toNumber(item.price ?? item.unitPrice, 0) / 100,
        total: (toNumber(item.price ?? item.unitPrice, 0) / 100) * toNumber(item.quantity, 1),
      }))
    ),
    expenses: expenseInfo.expenses,
    notes: defaultNotesForType("invoice"),
    terms: defaultTermsForType("invoice"),
    taxRate: defaultTaxRate,
    docLabel: "Invoice",
    sourceLabel: "Booking",
    linkedLabel: payload?.id ? `Booking #${payload.id}` : "Booking",
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
    documentType: savedDocument.documentType || baseDocument.documentType,
    title: savedDocument.title || baseDocument.title,
    invoiceNumber: savedDocument.invoiceNumber || baseDocument.invoiceNumber,
    issueDate: savedDocument.issueDate || baseDocument.issueDate,
    paymentStatus: savedDocument.paymentStatus || baseDocument.paymentStatus,
    depositAmount: toNumber(savedDocument.depositAmount, baseDocument.depositAmount),
    customer: {
      ...baseDocument.customer,
      ...(savedDocument.customer || {}),
    },
    event: {
      ...baseDocument.event,
      ...(savedDocument.event || {}),
    },
    lineItems: normalizeLineItems(savedDocument.lineItems),
    expenses: normalizeExpenses(savedDocument.expenses),
    notes: savedDocument.notes ?? baseDocument.notes,
    terms: savedDocument.terms ?? baseDocument.terms,
    taxRate: parseTaxRate(savedDocument.taxRate ?? baseDocument.taxRate),
    updatedAt: savedDocument.updatedAt || baseDocument.updatedAt,
    createdAt: savedDocument.createdAt || baseDocument.createdAt,
    sourceLabel: baseDocument.sourceLabel,
    linkedLabel: baseDocument.linkedLabel,
    docLabel: savedDocument.documentType === "receipt" ? "Receipt" : savedDocument.documentType === "invoice" ? "Invoice" : baseDocument.docLabel,
  };
};

const computeDocumentSummary = (document) => {
  const lineItems = normalizeLineItems(document?.lineItems);
  const expenses = normalizeExpenses(document?.expenses);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = parseTaxRate(document?.taxRate);
  const taxTotal = Number((subtotal * taxRate).toFixed(2));
  const grandTotal = Number((subtotal + taxTotal).toFixed(2));
  const rawDeposit = document?.documentType === "invoice" ? Math.max(0, toNumber(document?.depositAmount, 0)) : 0;
  const depositAmount = Math.min(rawDeposit, grandTotal);
  const amountPaid = document?.paymentStatus === "paid" ? grandTotal : depositAmount;
  const balanceDue = Math.max(0, Number((grandTotal - amountPaid).toFixed(2)));
  const expensesTotal = expenses.reduce((sum, item) => sum + item.amount, 0);

  return {
    ...document,
    docLabel: document?.documentType === "receipt" ? "Receipt" : "Invoice",
    lineItems,
    expenses,
    summary: {
      subtotal,
      taxRate,
      taxTotal,
      grandTotal,
      depositAmount,
      amountPaid,
      balanceDue,
      expensesTotal,
    },
  };
};

const buildStoredPayload = (document) => ({
  id: document.id,
  sourceType: document.sourceType,
  sourceId: document.sourceId,
  documentType: document.documentType,
  title: document.title || `${document.docLabel} ${document.invoiceNumber}`.trim(),
  invoiceNumber: document.invoiceNumber,
  issueDate: document.issueDate,
  paymentStatus: document.paymentStatus,
  depositAmount: document.documentType === "invoice" ? toNumber(document.depositAmount, 0) : 0,
  customerName: document.customer?.name || "",
  customerEmail: document.customer?.email || "",
  customerPhone: document.customer?.phone || "",
  eventDate: document.event?.eventDate || "",
  startTime: document.event?.startTime || "",
  endTime: document.event?.endTime || "",
  venueAddress: document.event?.venueAddress || "",
  lineItems: normalizeLineItems(document.lineItems),
  expenses: normalizeExpenses(document.expenses),
  notes: document.notes || "",
  terms: document.terms || "",
  taxRate: parseTaxRate(document.taxRate),
});

function DocumentPill({ value }) {
  const normalized = String(value || "draft").toLowerCase();
  const statusClass = normalized === "paid" ? "paid" : normalized === "draft" ? "draft" : "unpaid";
  return <span className={`invoice-pill ${statusClass}`}>{normalized}</span>;
}

function DocumentPreview({ document, companyConfig }) {
  const summary = document.summary;
  const lineItemSummary = document.lineItems.reduce(
    (accumulator, item) => {
      accumulator.count += 1;
      accumulator.quantity += Number(item.quantity) || 0;
      accumulator.unitPrice += Number(item.unitPrice) || 0;
      accumulator.total += Number(item.total) || 0;
      return accumulator;
    },
    { count: 0, quantity: 0, unitPrice: 0, total: 0 }
  );

  return (
    <div className="invoice-paper invoice-hub-paper">
      <div className="invoice-header">
        <div className="invoice-brand">
          <img className="invoice-logo" src={COMPANY.logo} alt="Reebs logo" />
          <div>
            <h2>{companyConfig.storeName || COMPANY.name}</h2>
            <p>{companyConfig.storeAddress || COMPANY.location}</p>
            <p>{companyConfig.storePhone || COMPANY.phone}</p>
            <p>{companyConfig.storeEmail || COMPANY.email}</p>
          </div>
        </div>
        <div className="invoice-meta">
          <p className="invoicing-label">{document.docLabel}</p>
          <h3>#{document.invoiceNumber}</h3>
          <p>{formatShortDate(document.issueDate)}</p>
        </div>
      </div>

      <div className="invoice-chip-row">
        <DocumentPill value={document.paymentStatus} />
        <span className="invoice-chip-detail">{document.linkedLabel}</span>
        {document.documentType === "invoice" ? (
          <span className="invoice-chip-detail">
            Balance {formatCurrency(summary.balanceDue, companyConfig.currency)}
          </span>
        ) : null}
      </div>

      <div className="invoice-hub-preview-grid">
        <article className="bubble-card invoice-hub-mini-card">
          <p className="invoicing-label">Bill to</p>
          <strong>{document.customer?.name || "Customer"}</strong>
          <span>{document.customer?.phone || "No phone"}</span>
          <span>{document.customer?.email || "No email"}</span>
        </article>

        {document.sourceType === "bookings" || document.event?.eventDate || document.event?.venueAddress ? (
          <article className="bubble-card invoice-hub-mini-card">
            <p className="invoicing-label">Event</p>
            <strong>{formatShortDate(document.event?.eventDate)}</strong>
            <span>
              {[document.event?.startTime, document.event?.endTime].filter(Boolean).join(" - ") || "Time pending"}
            </span>
            <span>{document.event?.venueAddress || "Venue pending"}</span>
          </article>
        ) : null}
      </div>

      <div className="invoice-table-wrapper">
        <table className="invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {document.lineItems.map((item, index) => (
              <tr key={item.id}>
                <td data-label="#">{index}</td>
                <td data-label="Description">{item.name || "Item"}</td>
                <td data-label="Qty">{item.quantity}</td>
                <td data-label="Unit">{formatCurrency(item.unitPrice, companyConfig.currency)}</td>
                <td data-label="Total">{formatCurrency(item.total, companyConfig.currency)}</td>
              </tr>
            ))}
          </tbody>
          {document.lineItems.length > 0 && (
            <tfoot className="admin-table-footer">
              <tr>
                <td className="admin-table-summary-cell is-count">
                  <span className="admin-table-summary-value">{lineItemSummary.count} items</span>
                </td>
                <td className="admin-table-summary-cell is-empty" />
                <td className="admin-table-summary-cell">
                  <span className="admin-table-summary-value">{lineItemSummary.quantity}</span>
                </td>
                <td className="admin-table-summary-cell">
                  <span className="admin-table-summary-value">
                    {formatCurrency(
                      lineItemSummary.count ? lineItemSummary.unitPrice / lineItemSummary.count : 0,
                      companyConfig.currency
                    )}
                  </span>
                </td>
                <td className="admin-table-summary-cell">
                  <span className="admin-table-summary-value">
                    {formatCurrency(lineItemSummary.total, companyConfig.currency)}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="invoice-hub-preview-footer">
        <div className="invoice-note-block">
          <h4>Note</h4>
          <div className="invoice-terms">
            <p>{document.notes || "No note added."}</p>
          </div>
          <h4>Terms</h4>
          <div className="invoice-terms">
            <p>{document.terms || defaultTermsForType(document.documentType)}</p>
          </div>
        </div>

        <div className="bubble-card invoice-summary-panel">
          <p className="invoicing-label">Summary</p>
          <div className="invoice-totals">
            <div className="invoice-total-row">
              <span>Subtotal</span>
              <span>{formatCurrency(summary.subtotal, companyConfig.currency)}</span>
            </div>
            {(summary.taxRate || 0) > 0 ? (
              <div className="invoice-total-row">
                <span>Tax</span>
                <span>{formatCurrency(summary.taxTotal, companyConfig.currency)}</span>
              </div>
            ) : null}
            <div className="invoice-total-row grand">
              <strong>Total</strong>
              <strong>{formatCurrency(summary.grandTotal, companyConfig.currency)}</strong>
            </div>
            {document.documentType === "invoice" ? (
              <>
                <div className="invoice-total-row">
                  <span>Deposit</span>
                  <span>{formatCurrency(summary.depositAmount, companyConfig.currency)}</span>
                </div>
                <div className="invoice-total-row">
                  <span>Balance</span>
                  <span>{formatCurrency(summary.balanceDue, companyConfig.currency)}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditableDocumentTemplate({
  document,
  companyConfig,
  onDocumentChange,
  onCustomerChange,
  onEventChange,
  onLineItemChange,
  onAddLineItem,
  onRemoveLineItem,
}) {
  const summary = document.summary;
  const lineItemSummary = document.lineItems.reduce(
    (accumulator, item) => {
      accumulator.count += 1;
      accumulator.quantity += Number(item.quantity) || 0;
      accumulator.unitPrice += Number(item.unitPrice) || 0;
      accumulator.total += Number(item.total) || 0;
      return accumulator;
    },
    { count: 0, quantity: 0, unitPrice: 0, total: 0 }
  );
  const showEventCard =
    document.sourceType === "bookings" ||
    document.sourceType === "manual" ||
    document.event?.eventDate ||
    document.event?.venueAddress ||
    document.event?.startTime ||
    document.event?.endTime;

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

        <div className="invoice-meta invoice-editable-meta">
          <label className="invoice-editable-meta-field">
            <span className="invoicing-label">Type</span>
            <select
              value={document.documentType}
              onChange={(event) =>
                onDocumentChange((current) => ({
                  ...current,
                  documentType: event.target.value,
                  docLabel: event.target.value === "receipt" ? "Receipt" : "Invoice",
                  terms:
                    current.terms === defaultTermsForType(current.documentType)
                      ? defaultTermsForType(event.target.value)
                      : current.terms,
                  notes:
                    current.notes === defaultNotesForType(current.documentType)
                      ? defaultNotesForType(event.target.value)
                      : current.notes,
                }))
              }
              disabled={document.sourceType !== "manual"}
            >
              <option value="receipt">Receipt</option>
              <option value="invoice">Invoice</option>
            </select>
          </label>

          <label className="invoice-editable-meta-field">
            <span className="invoicing-label">No.</span>
            <div className="invoice-editable-static-field">{document.invoiceNumber}</div>
          </label>

          <label className="invoice-editable-meta-field">
            <span className="invoicing-label">Date</span>
            <input
              type="date"
              value={document.issueDate}
              onChange={(event) => onDocumentChange({ issueDate: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="invoice-chip-row invoice-editable-chip-row">
        <label className="invoice-editable-status">
          <span className="invoicing-label">Status</span>
          <select
            value={document.paymentStatus}
            onChange={(event) => onDocumentChange({ paymentStatus: event.target.value })}
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <span className="invoice-chip-detail">
          {document.sourceType === "manual" ? MANUAL_LINKED_NOTE : document.linkedLabel}
        </span>

        {document.documentType === "invoice" ? (
          <span className="invoice-chip-detail">
            Balance {formatCurrency(summary.balanceDue, companyConfig.currency)}
          </span>
        ) : null}
      </div>

      <div className="invoice-hub-preview-grid invoice-editable-top-grid">
        <article className="bubble-card invoice-hub-mini-card invoice-editable-card">
          <p className="invoicing-label">Bill to</p>
          <div className="invoice-editable-card-grid">
            <label className="invoice-editable-field invoice-editable-field-full">
              <span>Customer</span>
              <input
                type="text"
                value={document.customer?.name || ""}
                onChange={(event) => onCustomerChange("name", event.target.value)}
              />
            </label>
            <label className="invoice-editable-field">
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
          <article className="bubble-card invoice-hub-mini-card invoice-editable-card">
            <p className="invoicing-label">Event</p>
            <div className="invoice-editable-card-grid">
              <label className="invoice-editable-field">
                <span>Date</span>
                <input
                  type="date"
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
            <p className="invoicing-label">Lines</p>
            <h4>Items on this document</h4>
          </div>

          <div className="invoice-editable-actions">
            <span className="invoice-editable-lines-count">{document.lineItems.length} lines</span>
            <button
              type="button"
              className="admin-secondary invoice-hub-inline-action"
              onClick={onAddLineItem}
            >
              <AppIcon icon={faPlus} />
              Add line
            </button>
          </div>
        </div>

        <div className="invoice-table-wrapper invoice-editable-table-wrapper">
          <table className="invoice-table invoice-editable-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {document.lineItems.map((item, index) => (
                <tr key={item.id}>
                  <td data-label="#">{index}</td>
                  <td data-label="Description">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(event) => onLineItemChange(item.id, "name", event.target.value)}
                      aria-label={`Line ${index} description`}
                    />
                  </td>
                  <td data-label="Qty">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) => onLineItemChange(item.id, "quantity", event.target.value)}
                      aria-label={`Line ${index} quantity`}
                    />
                  </td>
                  <td data-label="Unit">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) => onLineItemChange(item.id, "unitPrice", event.target.value)}
                      aria-label={`Line ${index} unit price`}
                    />
                  </td>
                  <td data-label="Total">
                    <strong>{formatCurrency(item.total, companyConfig.currency)}</strong>
                  </td>
                  <td data-label="">
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
              ))}
            </tbody>
            {document.lineItems.length > 0 ? (
              <tfoot className="admin-table-footer">
                <tr>
                  <td className="admin-table-summary-cell is-count">
                    <span className="admin-table-summary-value">{lineItemSummary.count} items</span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">{lineItemSummary.quantity}</span>
                  </td>
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">
                      {formatCurrency(
                        lineItemSummary.count ? lineItemSummary.unitPrice / lineItemSummary.count : 0,
                        companyConfig.currency
                      )}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell">
                    <span className="admin-table-summary-value">
                      {formatCurrency(lineItemSummary.total, companyConfig.currency)}
                    </span>
                  </td>
                  <td className="admin-table-summary-cell is-empty" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>

      <div className="invoice-hub-preview-footer invoice-editable-footer">
        <div className="invoice-note-block invoice-editable-note-block">
          <div className="invoice-editable-section-head">
            <p className="invoicing-label">Message</p>
            <h4>Closing copy</h4>
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

        <div className="bubble-card invoice-summary-panel invoice-editable-summary">
          <div className="invoice-editable-section-head">
            <p className="invoicing-label">Summary</p>
            <h4>Totals</h4>
          </div>

          <div className="invoice-editable-summary-grid">
            <label className="invoice-editable-field">
              <span>Tax %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={Number((document.taxRate || 0) * 100).toFixed(2)}
                onChange={(event) =>
                  onDocumentChange({ taxRate: toNumber(event.target.value, 0) / 100 })
                }
              />
            </label>

            {document.documentType === "invoice" ? (
              <label className="invoice-editable-field">
                <span>Deposit</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={document.depositAmount}
                  onChange={(event) =>
                    onDocumentChange({ depositAmount: toNumber(event.target.value, 0) })
                  }
                />
              </label>
            ) : null}
          </div>

          <div className="invoice-totals">
            <div className="invoice-total-row">
              <span>Subtotal</span>
              <span>{formatCurrency(summary.subtotal, companyConfig.currency)}</span>
            </div>
            {(summary.taxRate || 0) > 0 ? (
              <div className="invoice-total-row">
                <span>Tax</span>
                <span>{formatCurrency(summary.taxTotal, companyConfig.currency)}</span>
              </div>
            ) : null}
            <div className="invoice-total-row grand">
              <strong>Total</strong>
              <strong>{formatCurrency(summary.grandTotal, companyConfig.currency)}</strong>
            </div>
            {document.documentType === "invoice" ? (
              <>
                <div className="invoice-total-row">
                  <span>Deposit</span>
                  <span>{formatCurrency(summary.depositAmount, companyConfig.currency)}</span>
                </div>
                <div className="invoice-total-row">
                  <span>Balance</span>
                  <span>{formatCurrency(summary.balanceDue, companyConfig.currency)}</span>
                </div>
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
  const [creatingDocument, setCreatingDocument] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [savingPdfDocument, setSavingPdfDocument] = useState(false);
  const [emailingDocument, setEmailingDocument] = useState(false);
  const [archivingDocument, setArchivingDocument] = useState(false);

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
      const response = await fetch("/.netlify/functions/orders");
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
      const response = await fetch("/.netlify/functions/bookings");
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
      const response = await fetch("/.netlify/functions/invoice-documents");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load invoice documents.");
      }
      setSavedDocuments(Array.isArray(data) ? data.map(normalizeStoredDocument) : []);
    } catch (err) {
      console.error("Invoice documents fetch failed", err);
      setDocumentsError(err.message || "Unable to load invoice documents.");
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchOrders(), fetchBookings(), fetchSavedDocuments()]);
  }, [fetchBookings, fetchOrders, fetchSavedDocuments]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const archivedLinkedKeys = useMemo(() => {
    const keys = new Set();
    savedDocuments.forEach((document) => {
      if (document.archivedAt && document.sourceType !== "manual" && document.sourceId) {
        keys.add(buildEntryKey(document.sourceType, document.sourceId));
      }
    });
    return keys;
  }, [savedDocuments]);

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
      const amount =
        override
          ? computeDocumentSummary(override).summary.grandTotal
          : toNumber(order.total, 0);
      entries.push({
        key,
        id: override?.id || null,
        sourceType: "orders",
        sourceId: order.id,
        documentType: override?.documentType || "receipt",
        invoiceNumber: override?.invoiceNumber || (order.orderNumber ? `REC-${order.orderNumber}` : buildDocumentNumber("receipt")),
        customerName: override?.customer?.name || order.customerName || "Customer",
        issueDate: override?.issueDate || normalizeDateInput(order.date || order.orderDate || order.createdAt) || todayValue(),
        paymentStatus: override?.paymentStatus || "unpaid",
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
      const amount =
        override
          ? computeDocumentSummary(override).summary.grandTotal
          : toNumber(booking.totalAmount, 0) / 100;
      entries.push({
        key,
        id: override?.id || null,
        sourceType: "bookings",
        sourceId: booking.id,
        documentType: override?.documentType || "invoice",
        invoiceNumber: override?.invoiceNumber || `INV-${formatDateStamp(booking.eventDate)}-${booking.id}`,
        customerName: override?.customer?.name || booking.customerName || "Customer",
        issueDate: override?.issueDate || normalizeDateInput(booking.eventDate) || todayValue(),
        paymentStatus: override?.paymentStatus || "unpaid",
        total: amount,
        linkedLabel: `Booking #${booking.id}`,
        sourceLabel: "Booking",
        isManual: false,
        updatedAt: override?.updatedAt || booking.lastModifiedAt || booking.updatedAt || booking.createdAt || null,
      });
    });

    manualDocuments.forEach((document) => {
      const computed = computeDocumentSummary(document);
      entries.push({
        key: buildEntryKey("manual", null, document.id),
        id: document.id,
        sourceType: "manual",
        sourceId: null,
        documentType: document.documentType,
        invoiceNumber: document.invoiceNumber,
        customerName: document.customer?.name || "Customer",
        issueDate: document.issueDate,
        paymentStatus: document.paymentStatus,
        total: computed.summary.grandTotal,
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

  const visibleEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return documentEntries.filter((entry) => {
      if (documentFilter === "receipt" && entry.documentType !== "receipt") return false;
      if (documentFilter === "invoice" && entry.documentType !== "invoice") return false;
      if (paymentStatusFilter !== "all" && entry.paymentStatus !== paymentStatusFilter) return false;
      if (!term) return true;
      const blob = [
        entry.invoiceNumber,
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
  }, [documentEntries, documentFilter, paymentStatusFilter, searchTerm]);

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
    let cancelled = false;

    const loadSelectedDocument = async () => {
      if (!selectedEntry) {
        setSelectedDocument(null);
        setSelectedError("");
        return;
      }

      setSelectedLoading(true);
      setSelectedError("");

      try {
        if (selectedEntry.sourceType === "manual") {
          const manualDocument = manualDocuments.find((item) => item.id === selectedEntry.id) || null;
          if (!manualDocument) {
            throw new Error("Document not found.");
          }
          if (!cancelled) {
            setSelectedDocument(computeDocumentSummary(manualDocument));
          }
          return;
        }

        const endpoint =
          selectedEntry.sourceType === "bookings"
            ? `/.netlify/functions/getInvoiceDetails?id=${selectedEntry.sourceId}`
            : `/.netlify/functions/generateInvoice?orderId=${selectedEntry.sourceId}`;

        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(await readResponseError(response, "Failed to load document."));
        }
        const payload = await response.json();

        let baseDocument = null;
        if (selectedEntry.sourceType === "bookings") {
          const fallbackItems = bookings.find((item) => item.id === selectedEntry.sourceId)?.items || [];
          baseDocument = normalizeBookingDocument(payload, fallbackItems, defaultTaxRate);
        } else {
          const fallbackItems = orders.find((item) => item.id === selectedEntry.sourceId)?.items || [];
          baseDocument = normalizeOrderDocument(payload, fallbackItems, defaultTaxRate);
        }

        const override = savedLinkedMap.get(selectedEntry.key) || null;
        const merged = computeDocumentSummary(mergeDocument(baseDocument, override));
        if (!cancelled) {
          setSelectedDocument(merged);
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
  }, [selectedEntry, orders, bookings, savedLinkedMap, manualDocuments, defaultTaxRate]);

  const activeDocument = useMemo(
    () => (selectedDocument ? computeDocumentSummary(selectedDocument) : null),
    [selectedDocument]
  );

  const summaryCards = useMemo(() => {
    const total = visibleEntries.reduce((sum, entry) => sum + toNumber(entry.total, 0), 0);
    const paid = visibleEntries.filter((entry) => entry.paymentStatus === "paid").length;
    const open = visibleEntries.filter((entry) => entry.paymentStatus !== "paid").length;
    return { total, paid, open, count: visibleEntries.length };
  }, [visibleEntries]);

  const upsertSavedDocument = (saved) => {
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
  };

  const handleDocumentChange = (updater) => {
    setSaveError("");
    setSaveStatus("");
    setSelectedDocument((current) => {
      if (!current) return current;
      const next = typeof updater === "function" ? updater(current) : { ...current, ...updater };
      return computeDocumentSummary(next);
    });
  };

  const handleCustomerChange = (field, value) => {
    handleDocumentChange((current) => ({
      ...current,
      customer: {
        ...current.customer,
        [field]: value,
      },
    }));
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
          ? {
            ...item,
            [field]:
              field === "quantity" || field === "unitPrice"
                ? Math.max(0, toNumber(value, 0))
                : value,
          }
          : item
      ),
    }));
  };

  const handleAddLineItem = () => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: [...current.lineItems, createLineItem()],
    }));
  };

  const handleRemoveLineItem = (itemId) => {
    handleDocumentChange((current) => ({
      ...current,
      lineItems: current.lineItems.filter((item) => item.id !== itemId),
    }));
  };

  const closeEditorModal = useCallback(() => {
    setEditorOpen(false);
    setSelectedLoading(false);
    setSelectedError("");
  }, []);

  const handleSelectEntry = useCallback((entryKey) => {
    setSaveError("");
    setSaveStatus("");
    setSelectedError("");
    setSelectedDocument(null);
    setSelectedLoading(true);
    setEditorOpen(true);
    setSelectedKey(entryKey);
  }, []);

  const handleEntryKeyDown = useCallback((event, entryKey) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelectEntry(entryKey);
    }
  }, [handleSelectEntry]);

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
      const saved = normalizeStoredDocument(data);
      upsertSavedDocument(saved);
      setSelectedDocument(null);
      setSelectedLoading(true);
      setSelectedError("");
      setEditorOpen(true);
      setSelectedKey(buildEntryKey("manual", null, saved.id));
      setDocumentFilter("all");
      setSaveStatus(`${saved.docLabel} created.`);
    } catch (err) {
      console.error("Create draft document failed", err);
      setSaveError(err.message || "Failed to create document.");
    } finally {
      setCreatingDocument("");
    }
  };

  const saveSelectedDocument = async () => {
    if (!activeDocument) return;
    setSavingDocument(true);
    setSaveError("");
    setSaveStatus("");

    try {
      const payload = buildStoredPayload(activeDocument);
      const response = await fetch("/.netlify/functions/invoice-documents", {
        method: activeDocument.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to save document."));
      }
      const data = await response.json();
      const saved = normalizeStoredDocument(data);
      upsertSavedDocument(saved);
      setSelectedKey(buildEntryKey(saved.sourceType, saved.sourceId, saved.id));
      setSelectedDocument((current) => computeDocumentSummary(mergeDocument(current || activeDocument, saved)));
      setSaveStatus("Saved.");
    } catch (err) {
      console.error("Save document failed", err);
      setSaveError(err.message || "Failed to save document.");
    } finally {
      setSavingDocument(false);
    }
  };

  const createPdfDoc = async () => {
    if (!activeDocument) return null;
    const document = activeDocument;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const headerTop = 16;
    let logoLoaded = false;

    try {
      const logoData = await loadImageData(COMPANY.logo);
      doc.addImage(logoData, "PNG", margin, headerTop - 4, 24, 24);
      logoLoaded = true;
    } catch (err) {
      console.warn("Logo load failed", err);
    }

    const textX = logoLoaded ? margin + 30 : margin;
    doc.setFontSize(16);
    doc.text(config.storeName || COMPANY.name, textX, headerTop + 4);
    doc.setFontSize(10);
    doc.text(config.storeAddress || COMPANY.location, textX, headerTop + 10);
    doc.text(config.storePhone || COMPANY.phone, textX, headerTop + 15);
    doc.text(config.storeEmail || COMPANY.email, textX, headerTop + 20);

    doc.setFontSize(18);
    doc.text(document.docLabel.toUpperCase(), pageWidth - margin, headerTop + 2, { align: "right" });
    doc.setFontSize(11);
    doc.text(`#${document.invoiceNumber}`, pageWidth - margin, headerTop + 9, { align: "right" });
    doc.text(`Date: ${formatShortDate(document.issueDate)}`, pageWidth - margin, headerTop + 15, {
      align: "right",
    });

    let cursorY = headerTop + 30;
    doc.setDrawColor(220);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 10;

    doc.setFontSize(12);
    doc.text("Bill To", margin, cursorY);
    doc.setFontSize(10);
    const billLines = [
      document.customer?.name || "-",
      document.customer?.phone,
      document.customer?.email,
    ].filter(Boolean);
    billLines.forEach((line, index) => {
      doc.text(String(line), margin, cursorY + 6 + index * 5);
    });

    let detailY = cursorY + 8 + billLines.length * 5;
    if (document.event?.eventDate || document.event?.venueAddress) {
      doc.setFontSize(11);
      doc.text("Event", margin, detailY);
      doc.setFontSize(10);
      const eventLine = `${formatShortDate(document.event?.eventDate)} ${document.event?.startTime || ""}${
        document.event?.endTime ? ` - ${document.event.endTime}` : ""
      }`.trim();
      doc.text(eventLine || "-", margin, detailY + 6);
      if (document.event?.venueAddress) {
        doc.text(document.event.venueAddress, margin, detailY + 12);
        detailY += 18;
      } else {
        detailY += 12;
      }
    }

    const body = document.lineItems.map((item) => [
      item.name || "Item",
      item.quantity || 0,
      formatPdfCurrency(item.unitPrice || 0, config.currency || "GHS"),
      formatPdfCurrency(item.total || 0, config.currency || "GHS"),
    ]);

    const tableConfig = {
      startY: detailY + 8,
      head: [["Description", "Qty", "Unit", "Total"]],
      body,
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [31, 37, 48], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    };

    if (typeof doc.autoTable === "function") {
      doc.autoTable(tableConfig);
    } else {
      autoTable(doc, tableConfig);
    }

    const finalY = doc.lastAutoTable?.finalY || tableConfig.startY + 20;
    const totalsX = pageWidth - margin - 72;
    let totalsY = finalY + 10;

    doc.setFillColor(245, 245, 245);
    doc.rect(totalsX, totalsY - 4, 72, document.documentType === "invoice" ? 36 : 24, "F");
    doc.setFontSize(10);
    doc.text("Subtotal", totalsX + 4, totalsY + 4);
    doc.text(formatPdfCurrency(document.summary.subtotal, config.currency || "GHS"), pageWidth - margin, totalsY + 4, {
      align: "right",
    });
    if ((document.summary.taxRate || 0) > 0) {
      doc.text("Tax", totalsX + 4, totalsY + 10);
      doc.text(formatPdfCurrency(document.summary.taxTotal, config.currency || "GHS"), pageWidth - margin, totalsY + 10, {
        align: "right",
      });
    }
    doc.setFontSize(11);
    doc.text("Total", totalsX + 4, totalsY + 18);
    doc.text(formatPdfCurrency(document.summary.grandTotal, config.currency || "GHS"), pageWidth - margin, totalsY + 18, {
      align: "right",
    });

    if (document.documentType === "invoice") {
      doc.setFontSize(10);
      doc.text("Deposit", totalsX + 4, totalsY + 24);
      doc.text(formatPdfCurrency(document.summary.depositAmount, config.currency || "GHS"), pageWidth - margin, totalsY + 24, {
        align: "right",
      });
      doc.text("Balance", totalsX + 4, totalsY + 30);
      doc.text(formatPdfCurrency(document.summary.balanceDue, config.currency || "GHS"), pageWidth - margin, totalsY + 30, {
        align: "right",
      });
      totalsY += 14;
    }

    const notesText = [document.notes, document.terms].filter(Boolean).join(" ");
    if (notesText) {
      const noteLines = doc.splitTextToSize(notesText, pageWidth - margin * 2);
      doc.setFontSize(9);
      doc.text(noteLines, margin, totalsY + 20);
    }

    return doc;
  };

  const buildPdf = async () => {
    if (!activeDocument) return;
    setPdfLoading(true);
    setSaveError("");
    try {
      const doc = await createPdfDoc();
      if (!doc) return;
      const prefix = activeDocument.documentType === "receipt" ? "receipt" : "invoice";
      doc.save(`${prefix}-${activeDocument.invoiceNumber}.pdf`);
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

      const prefix = activeDocument.documentType === "receipt" ? "receipt" : "invoice";
      const response = await fetch("/.netlify/functions/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${activeDocument.docLabel} ${activeDocument.invoiceNumber}`,
          category: activeDocument.docLabel,
          fileName: `${prefix}-${activeDocument.invoiceNumber}.pdf`,
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
      const response = await fetch("/.netlify/functions/invoice-document-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: activeDocument.documentType,
          docLabel: activeDocument.docLabel,
          invoiceNumber: activeDocument.invoiceNumber,
          issueDate: activeDocument.issueDate,
          paymentStatus: activeDocument.paymentStatus,
          customerName: activeDocument.customer?.name || "",
          customerEmail: activeDocument.customer?.email || "",
          linkedLabel: activeDocument.linkedLabel || "",
          lineItems: activeDocument.lineItems,
          notes: activeDocument.notes || "",
          terms: activeDocument.terms || "",
          taxRate: activeDocument.taxRate,
          depositAmount: activeDocument.depositAmount,
          currency: config.currency,
        }),
      });
      if (!response.ok) {
        throw new Error(await readResponseError(response, "Failed to send document email."));
      }
      setSaveStatus(`Sent to ${activeDocument.customer.email}.`);
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
      await fetchSavedDocuments();
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
    const label = `${activeDocument.docLabel} ${activeDocument.invoiceNumber}`.trim();
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
    const label = `${entry.documentType === "receipt" ? "Receipt" : "Invoice"} ${entry.invoiceNumber}`.trim();
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
      },
      label
    );
  };

  const workspaceError = selectedError || documentsError || ordersError || bookingsError;
  const documentTitle = selectedLoading
    ? "Opening document"
    : activeDocument
      ? `${activeDocument.docLabel} #${activeDocument.invoiceNumber}`
      : "Document";

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
                  disabled={savingDocument || !activeDocument}
                  aria-label={savingDocument ? "Saving document" : "Save document"}
                  title={savingDocument ? "Saving document" : "Save document"}
                >
                  <AppIcon icon={faFloppyDisk} />
                  <span className="sr-only">{savingDocument ? "Saving document" : "Save document"}</span>
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
              <section className="glass-card invoice-hub-editor">
                <div className="invoice-hub-editor-head">
                  <div>
                    <p className="invoicing-label">Builder</p>
                    <h2>{activeDocument.docLabel} template</h2>
                  </div>
                  <DocumentPill value={activeDocument.paymentStatus} />
                </div>
                <EditableDocumentTemplate
                  document={activeDocument}
                  companyConfig={config}
                  onDocumentChange={handleDocumentChange}
                  onCustomerChange={handleCustomerChange}
                  onEventChange={handleEventChange}
                  onLineItemChange={handleLineItemChange}
                  onAddLineItem={handleAddLineItem}
                  onRemoveLineItem={handleRemoveLineItem}
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

        <section className="invoice-hub-kpis" aria-label="Invoice summary">
          <article className="bubble-card invoice-hub-kpi">
            <p>Open</p>
            <strong>{summaryCards.open}</strong>
            <span>Draft or unpaid</span>
          </article>
          <article className="bubble-card invoice-hub-kpi">
            <p>Paid</p>
            <strong>{summaryCards.paid}</strong>
            <span>Marked paid</span>
          </article>
          <article className="bubble-card invoice-hub-total-card">
            <p>Total value</p>
            <strong>{formatCurrency(summaryCards.total, config.currency)}</strong>
          </article>
        </section>

        <section className="invoice-hub-toolbar" aria-label="Invoice filters">
          <SearchField
            className="invoice-hub-search"
            inputClassName="invoice-hub-search-input"
            clearClassName="invoice-hub-search-clear"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClear={() => setSearchTerm("")}
            placeholder="Search invoice, receipt, customer or source"
          />

          <div className="invoice-hub-toolbar-filters">
            <label className="invoice-hub-toolbar-filter">
              <span>Type</span>
              <select value={documentFilter} onChange={(event) => setDocumentFilter(event.target.value)}>
                {DOCUMENT_TYPE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="invoice-hub-toolbar-filter">
              <span>Status</span>
              <select
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
              >
                {PAYMENT_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="admin-table invoice-hub-table" aria-label="Invoices and receipts">

          {ordersLoading || bookingsLoading || documentsLoading ? (
            <p className="invoicing-muted">Loading documents...</p>
          ) : workspaceError && !visibleEntries.length ? (
            <p className="invoicing-error">{workspaceError}</p>
          ) : visibleEntries.length === 0 ? (
            <p className="invoicing-muted">No documents match this view.</p>
          ) : (
            <div className="admin-table-scroll inventory-table-scroll invoice-hub-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th className="table-row-index">#</th>
                    <th>Document</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Archive</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEntries.map((entry, index) => (
                    <tr
                      key={entry.key}
                      className={`invoice-hub-table-row ${selectedKey === entry.key ? "is-active" : ""}`}
                      tabIndex={0}
                      onClick={() => handleSelectEntry(entry.key)}
                      onKeyDown={(event) => handleEntryKeyDown(event, entry.key)}
                    >
                      <td className="table-row-index">{index}</td>
                      <td>
                        <div className="admin-product invoice-hub-table-document">
                          <span className="admin-product-name">{entry.invoiceNumber}</span>
                        </div>
                      </td>
                      <td>{entry.customerName || "-"}</td>
                      <td>
                        <span className="invoice-hub-table-type">
                          {entry.documentType === "receipt" ? "Receipt" : "Invoice"}
                        </span>
                      </td>
                      <td>{entry.linkedLabel}</td>
                      <td>{formatShortDate(entry.issueDate)}</td>
                      <td><DocumentPill value={entry.paymentStatus} /></td>
                      <td>{formatCurrency(entry.total, config.currency)}</td>
                      <td>
                        <button
                          type="button"
                          className="invoice-hub-table-action invoice-hub-table-action-danger"
                          onClick={(event) => archiveEntryFromList(entry, event)}
                          onKeyDown={(event) => event.stopPropagation()}
                          disabled={archivingDocument}
                          aria-label={`Archive ${entry.invoiceNumber}`}
                          title={`Archive ${entry.invoiceNumber}`}
                        >
                          <AppIcon icon={faBoxArchive} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {visibleEntries.length > 0 && (
                  <tfoot className="admin-table-footer">
                    <tr>
                      <td className="admin-table-summary-cell is-count">
                        <span className="admin-table-summary-value">{summaryCards.count}</span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell is-empty" />
                      <td className="admin-table-summary-cell">
                        <span className="admin-table-summary-value">
                          {formatCurrency(summaryCards.total, config.currency)}
                        </span>
                      </td>
                      <td className="admin-table-summary-cell is-empty" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminInvoicing;
