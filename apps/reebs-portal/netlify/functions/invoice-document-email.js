/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import emailKit from "../../../../packages/email-kit/src/index.cjs";
import { requirePermission, respond } from "./_shared/internalApi.js";
import { sendNotificationEmail } from "./_shared/email.js";
import { DEFAULT_SERVICE_DEPOSIT_DUE_LABEL } from "../../shared/paymentCopy.js";

const {
  EMAIL_THEMES,
  renderDataTable,
  renderEmailLayout,
  renderKeyValueTable,
  renderMetricGrid,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

const INVOICE_DOCUMENT_EMAIL_METHODS = "POST,OPTIONS";
const FAAKO_THEME = EMAIL_THEMES.faako;
const SERVICE_DEPOSIT_SUMMARY_LABEL = "Deposit due (70%)";
const SERVICE_BALANCE_SUMMARY_LABEL = "Remaining balance";
const SERVICE_DUE_DATE_LABEL = "Deposit due date";
const INVOICE_DEPOSIT_RATE = 0.7;

const cleanText = (value, maxLength = 400) => {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const cleanEmail = (value) => {
  const email = cleanText(value, 200).toLowerCase();
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  return email;
};

const normalizeMoney = (value, fallback = 0) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return fallback;
  return Math.round(amount * 100) / 100;
};

const normalizeDateValue = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const todayValue = () => new Date().toISOString().slice(0, 10);

const isInvoiceFullPaymentDue = (document) => {
  if (document?.documentType !== "invoice") return false;
  if (String(document?.paymentStatus || "").toLowerCase() === "paid") return false;
  const dueDate = normalizeDateValue(document?.dueDate);
  return Boolean(dueDate) && dueDate < todayValue();
};

const getInvoiceDueDateSummaryLabel = (document) =>
  document?.documentType === "invoice" && isInvoiceFullPaymentDue(document) ? "Payment due date" : SERVICE_DUE_DATE_LABEL;

const getInvoiceDepositLabel = (document) =>
  isInvoiceFullPaymentDue(document) ? "Amount due (100%)" : SERVICE_DEPOSIT_SUMMARY_LABEL;

const normalizeTaxRate = (value) => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const normalized = rate > 1 ? rate / 100 : rate;
  return Math.min(Math.max(normalized, 0), 1);
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
  const cleaned = cleanText(value, 80);
  return cleaned || "Per item";
};

const normalizeLineItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 200)
    .map((item, index) => {
      const rowType = normalizeLineRowType(item?.rowType);
      const quantity = Math.max(0, normalizeMoney(item?.quantity, 1));
      const unitPrice = Math.max(0, normalizeMoney(item?.unitPrice, 0));
      const name = cleanText(item?.name, 240);
      return {
        id: cleanText(item?.id, 80) || `line-${index + 1}`,
        rowType,
        name: rowType === "item" ? name || `Item ${index + 1}` : name,
        unitLabel: rowType === "item" ? normalizeLineUnitLabel(item?.unitLabel) : "",
        quantity: rowType === "item" ? quantity : 0,
        unitPrice: rowType === "item" ? unitPrice : 0,
        total: rowType === "item" ? Math.round(quantity * unitPrice * 100) / 100 : 0,
      };
    })
    .filter((item) => item.rowType === "item" || item.name);
};

const normalizeAdditionalItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 100)
    .map((item, index) => {
      const quantity = Math.max(0, normalizeMoney(item?.quantity, 1));
      const unitPrice = Math.max(0, normalizeMoney(item?.unitPrice, 0));
      return {
        id: cleanText(item?.id, 80) || `additional-${index + 1}`,
        description: cleanText(item?.description, 240) || `Additional item ${index + 1}`,
        quantity,
        unitLabel: normalizeLineUnitLabel(item?.unitLabel),
        unitPrice,
        total: Math.round(quantity * unitPrice * 100) / 100,
      };
    });
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

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const titleCase = (value) =>
  String(value || "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const formatDocumentIdentity = (document) => {
  const number = cleanText(document?.invoiceNumber, 120);
  if (!number) return cleanText(document?.docLabel, 40) || "Document";
  return `${cleanText(document?.docLabel, 40) || "Document"} ${number}`;
};

const buildDocumentIntro = (document, summary, currency) => {
  const customerName = document?.customerName || "there";
  const documentIdentity = formatDocumentIdentity(document);
  const balanceLabel =
    document?.documentType === "invoice"
      ? formatCurrency(summary.fullPaymentDue ? summary.depositAmount : summary.balanceDue, currency)
      : formatCurrency(summary.grandTotal, currency);

  return [
    `Hello ${customerName},`,
    document?.documentType === "receipt"
      ? `Your receipt is ready. ${documentIdentity} is attached below for your records.`
      : `Your invoice is ready. ${documentIdentity} is prepared with a ${summary.fullPaymentDue ? "full amount due" : "remaining balance"} of ${balanceLabel}.`,
    document?.dueDate
      ? `Please review the ${document?.documentType === "invoice" ? getInvoiceDueDateSummaryLabel(document).toLowerCase() : "due date"} of ${formatDate(document.dueDate)} and the item breakdown below.`
      : "Please review the document details and item breakdown below.",
  ];
};

const buildDocumentDetailRows = (document) =>
  [
    ["Document", formatDocumentIdentity(document)],
    ["Customer", document?.customerName || "Customer"],
    ["Status", titleCase(document?.paymentStatus || "draft")],
    ["Issue date", formatDate(document?.issueDate)],
    ...(document?.dueDate
      ? [[document?.documentType === "invoice" ? getInvoiceDueDateSummaryLabel(document) : "Due date", formatDate(document.dueDate)]]
      : []),
    ...(document?.linkedLabel ? [["Source", document.linkedLabel]] : []),
  ].filter(([, value]) => String(value || "").trim());

const buildSummaryRows = (document, summary, currency) => [
  ["Subtotal", formatCurrency(summary.subtotal, currency)],
  ...(summary.additionalTotal > 0 ? [["Additional items", formatCurrency(summary.additionalTotal, currency)]] : []),
  ...(summary.taxRate > 0 ? [["Tax", formatCurrency(summary.taxTotal, currency)]] : []),
  ...(summary.discountTotal > 0 ? [["Discount", `-${formatCurrency(summary.discountTotal, currency)}`]] : []),
  ["Total", formatCurrency(summary.grandTotal, currency)],
  ...(document?.documentType === "invoice"
    ? [
        [getInvoiceDepositLabel(document), formatCurrency(summary.depositAmount, currency)],
        ...(summary.fullPaymentDue
          ? []
          : [[SERVICE_BALANCE_SUMMARY_LABEL, formatCurrency(summary.balanceDue, currency)]]),
      ]
    : []),
];

const buildLineItemTableRows = (summary, currency) => {
  let billableIndex = 0;
  const rows = [];

  summary.lineItems.forEach((item) => {
    if (isHeadingLineItem(item)) {
      rows.push([`Section: ${item.name}`, "", "", "", ""]);
      return;
    }

    if (isNoteLineItem(item)) {
      rows.push([`Note: ${item.name}`, "", "", "", ""]);
      return;
    }

    billableIndex += 1;
    rows.push([
      `${billableIndex}. ${item.name}`,
      String(item.quantity),
      item.unitLabel || "Per item",
      formatCurrency(item.unitPrice, currency),
      formatCurrency(item.total, currency),
    ]);
  });

  summary.additionalItems.forEach((item, index) => {
    rows.push([
      `Extra ${index + 1}. ${item.description}`,
      String(item.quantity),
      item.unitLabel || "Per item",
      formatCurrency(item.unitPrice, currency),
      formatCurrency(item.total, currency),
    ]);
  });

  return rows;
};

const buildSummary = (document) => {
  const lineItems = normalizeLineItems(document?.lineItems);
  const additionalItems = normalizeAdditionalItems(document?.additionalItems);
  const billableLineItems = lineItems.filter((item) => !isHeadingLineItem(item) && !isNoteLineItem(item));
  const subtotal = billableLineItems.reduce((sum, item) => sum + item.total, 0);
  const additionalTotal = additionalItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = normalizeTaxRate(document?.taxRate);
  const taxTotal = Math.round((subtotal + additionalTotal) * taxRate * 100) / 100;
  const rawDiscount = Math.max(0, normalizeMoney(document?.discountAmount, 0));
  const discountTotal = Math.min(rawDiscount, subtotal + additionalTotal + taxTotal);
  const grandTotal = Math.max(
    0,
    Math.round((subtotal + additionalTotal + taxTotal - discountTotal) * 100) / 100
  );
  const depositAmount =
    document?.documentType === "invoice"
      ? isInvoiceFullPaymentDue(document)
        ? grandTotal
        : Math.round(grandTotal * INVOICE_DEPOSIT_RATE * 100) / 100
      : 0;
  const balanceDue =
    document?.documentType === "invoice" && isInvoiceFullPaymentDue(document)
      ? 0
      : Math.max(0, Math.round((grandTotal - depositAmount) * 100) / 100);
  return {
    lineItems,
    additionalItems,
    billableLineItems,
    subtotal,
    additionalTotal,
    taxRate,
    taxTotal,
    discountTotal,
    grandTotal,
    depositAmount,
    balanceDue,
    fullPaymentDue: isInvoiceFullPaymentDue(document),
  };
};

const buildEmailText = (document, summary, currency) => {
  const documentIdentity = formatDocumentIdentity(document);
  const lines = [
    documentIdentity,
    "",
    `Customer: ${document.customerName || "Customer"}`,
    `Status: ${titleCase(document.paymentStatus || "draft")}`,
    `Issue date: ${formatDate(document.issueDate)}`,
    ...(document.dueDate
      ? [`${document.documentType === "invoice" ? getInvoiceDueDateSummaryLabel(document).replace(" date", "") : "Due"}: ${formatDate(document.dueDate)}`]
      : []),
  ];

  if (document.linkedLabel) {
    lines.push(`Source: ${document.linkedLabel}`);
  }

  lines.push("", "Items:");
  let billableIndex = 0;
  summary.lineItems.forEach((item) => {
    if (isHeadingLineItem(item)) {
      lines.push(`-- ${item.name} --`);
      return;
    }
    if (isNoteLineItem(item)) {
      lines.push(`* ${item.name}`);
      return;
    }
    billableIndex += 1;
    lines.push(
      `${billableIndex}. ${item.name} | Qty ${item.quantity} | Rate ${item.unitLabel || "Per item"} | Price ${formatCurrency(item.unitPrice, currency)} | Total ${formatCurrency(item.total, currency)}`
    );
  });
  summary.additionalItems.forEach((item, index) => {
    lines.push(
      `Extra ${index + 1}. ${item.description} | Qty ${item.quantity} | Rate ${item.unitLabel || "Per item"} | Price ${formatCurrency(item.unitPrice, currency)} | Total ${formatCurrency(item.total, currency)}`
    );
  });

  lines.push("");
  lines.push(`Subtotal: ${formatCurrency(summary.subtotal, currency)}`);
  if (summary.additionalTotal > 0) {
    lines.push(`Additional items: ${formatCurrency(summary.additionalTotal, currency)}`);
  }
  if (summary.taxRate > 0) {
    lines.push(`Tax: ${formatCurrency(summary.taxTotal, currency)}`);
  }
  if (summary.discountTotal > 0) {
    lines.push(`Discount: -${formatCurrency(summary.discountTotal, currency)}`);
  }
  lines.push(`Total: ${formatCurrency(summary.grandTotal, currency)}`);
  if (document.documentType === "invoice") {
    lines.push(`${getInvoiceDepositLabel(document)}: ${formatCurrency(summary.depositAmount, currency)}`);
    if (!summary.fullPaymentDue) {
      lines.push(`${SERVICE_BALANCE_SUMMARY_LABEL}: ${formatCurrency(summary.balanceDue, currency)}`);
    }
  }
  if (document.notes) {
    lines.push("", `Note: ${document.notes}`);
  }
  if (document.terms) {
    lines.push("", `Terms: ${document.terms}`);
  }
  return lines.join("\n");
};

const buildEmailHtml = (document, summary, currency) => {
  const documentIdentity = formatDocumentIdentity(document);
  const metricCards = [
    { label: "Total", value: formatCurrency(summary.grandTotal, currency) },
    { label: "Status", value: titleCase(document.paymentStatus || "draft") },
    {
      label: document.documentType === "invoice" ? (summary.fullPaymentDue ? "Amount due" : "Balance due") : "Items",
      value:
        document.documentType === "invoice"
          ? formatCurrency(summary.fullPaymentDue ? summary.depositAmount : summary.balanceDue, currency)
          : String(summary.billableLineItems.length || 0),
    },
    {
      label: document.dueDate
        ? document.documentType === "invoice"
          ? getInvoiceDueDateSummaryLabel(document)
          : "Due date"
        : "Issue date",
      value: formatDate(document.dueDate || document.issueDate),
    },
  ];

  const bodyBlocks = [
    renderMetricGrid(metricCards, { theme: FAAKO_THEME }),
    renderPanel({
      theme: FAAKO_THEME,
      eyebrow: "Document details",
      title: documentIdentity,
      bodyHtml: renderKeyValueTable(buildDocumentDetailRows(document), {
        theme: FAAKO_THEME,
        labelWidth: "32%",
      }),
    }),
    renderPanel({
      theme: FAAKO_THEME,
      eyebrow: "Product items",
      title: "Document breakdown",
      bodyHtml: renderDataTable({
        headers: ["Description", "Qty", "Rate", "Price", "Total"],
        rows: buildLineItemTableRows(summary, currency),
        aligns: ["left", "right", "left", "right", "right"],
        theme: FAAKO_THEME,
      }),
    }),
    renderPanel({
      theme: FAAKO_THEME,
      eyebrow: "Amounts",
      title: document.documentType === "invoice" ? "Balance summary" : "Receipt summary",
      bodyHtml: renderKeyValueTable(buildSummaryRows(document, summary, currency), {
        theme: FAAKO_THEME,
        labelWidth: "42%",
      }),
    }),
  ];

  if (
    document.documentType === "invoice" &&
    String(document.paymentStatus || "draft").toLowerCase() !== "paid" &&
    summary.depositAmount > 0
  ) {
    bodyBlocks.splice(
      1,
      0,
      renderNotice({
        theme: FAAKO_THEME,
        title: "Payment due",
        lines: document.dueDate
          ? [
              `${getInvoiceDepositLabel(document)}: ${formatCurrency(summary.depositAmount, currency)}`,
              summary.fullPaymentDue
                ? `The deposit date has passed. Please settle the full amount by ${formatDate(document.dueDate)}.`
                : `Please settle the deposit by ${formatDate(document.dueDate)}. This is ${DEFAULT_SERVICE_DEPOSIT_DUE_LABEL.toLowerCase()}.`,
            ]
          : [`${getInvoiceDepositLabel(document)}: ${formatCurrency(summary.depositAmount, currency)}`],
      })
    );
  }

  if (document.notes) {
    bodyBlocks.push(
      renderPanel({
        theme: FAAKO_THEME,
        eyebrow: "Notes",
        title: "Additional note",
        bodyHtml: renderParagraphs(document.notes, {
          theme: FAAKO_THEME,
          spacing: "0",
        }),
      })
    );
  }

  if (document.terms) {
    bodyBlocks.push(
      renderPanel({
        theme: FAAKO_THEME,
        eyebrow: "Terms",
        title: "Document terms",
        bodyHtml: renderParagraphs(document.terms, {
          theme: FAAKO_THEME,
          spacing: "0",
        }),
      })
    );
  }

  return renderEmailLayout({
    theme: FAAKO_THEME,
    preheader: `${documentIdentity} for ${document.customerName || "your account"} totals ${formatCurrency(summary.grandTotal, currency)}.`,
    brandName: "REEBS Party Themes",
    brandTagline: "Delivered through Faako Systems",
    eyebrow: `${titleCase(document.documentType)} ready`,
    title: documentIdentity,
    subtitle:
      document.documentType === "receipt"
        ? "A themed copy of your receipt is ready for your records."
        : "A themed copy of your invoice is ready for review and payment.",
    introHtml: renderParagraphs(buildDocumentIntro(document, summary, currency), {
      theme: FAAKO_THEME,
    }),
    bodyHtml: bodyBlocks.join(""),
    footerHtml: `<p style="margin:0;color:${FAAKO_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">This document was sent from REEBS Party Themes using the Faako Systems email service.</p>`,
  });
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
  }

  if (event.httpMethod !== "POST") {
    return respond(event, 405, { error: "Method Not Allowed" }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult = await requirePermission(client, event, "invoices:write", {
      methods: INVOICE_DOCUMENT_EMAIL_METHODS,
    });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return respond(event, 400, { error: "Invalid JSON body." }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
    }

    const to = cleanEmail(payload.customerEmail || payload.to);
    const docLabel = cleanText(
      payload.docLabel || (payload.documentType === "receipt" ? "Receipt" : "Invoice"),
      40
    );
    const invoiceNumber = cleanText(payload.invoiceNumber, 120);
    const customerName = cleanText(payload.customerName, 200) || "Customer";
    const paymentStatus = cleanText(payload.paymentStatus, 20).toLowerCase() || "draft";
    const linkedLabel = cleanText(payload.linkedLabel, 120);
    const currency = cleanText(payload.currency, 12) || "GHS";
    const issueDate = cleanText(payload.issueDate, 40);
    const dueDate = cleanText(payload.dueDate, 40);
    const documentType = cleanText(payload.documentType, 20).toLowerCase() === "receipt" ? "receipt" : "invoice";
    const notes = cleanText(payload.notes, 4000);
    const terms = cleanText(payload.terms, 4000);
    const taxRate = normalizeTaxRate(payload.taxRate);
    const depositAmount = Math.max(0, normalizeMoney(payload.depositAmount, 0));
    const discountAmount = Math.max(0, normalizeMoney(payload.discountAmount, 0));
    const lineItems = normalizeLineItems(payload.lineItems);
    const additionalItems = normalizeAdditionalItems(payload.additionalItems);

    if (!to) {
      return respond(event, 400, { error: "Customer email is required." }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
    }
    if (!invoiceNumber) {
      return respond(event, 400, { error: "Document number is required." }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
    }
    if (!lineItems.some((item) => !isHeadingLineItem(item) && !isNoteLineItem(item))) {
      return respond(event, 400, { error: "Add at least one line before sending." }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
    }

    const document = {
      docLabel,
      invoiceNumber,
      customerName,
      paymentStatus,
      linkedLabel,
      issueDate,
      dueDate,
      documentType,
      notes,
      terms,
      taxRate,
      depositAmount,
      discountAmount,
      lineItems,
      additionalItems,
    };
    const summary = buildSummary(document);
    const result = await sendNotificationEmail({
      to,
      subject: `${docLabel} ${invoiceNumber} from REEBS`,
      text: buildEmailText(document, summary, currency),
      html: buildEmailHtml(document, summary, currency),
    });

    if (result?.skipped) {
      return respond(
        event,
        503,
        { error: "Email delivery is not available right now." },
        { methods: INVOICE_DOCUMENT_EMAIL_METHODS }
      );
    }

    return respond(event, 200, { ok: true, deliveredTo: to }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
  } catch (err) {
    console.error("invoice-document-email error:", err);
    return respond(
      event,
      500,
      { error: err?.message || "Failed to send document email." },
      { methods: INVOICE_DOCUMENT_EMAIL_METHODS }
    );
  } finally {
    await client.end().catch(() => {});
  }
}
