/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";
import { sendNotificationEmail } from "./_shared/email.js";

const INVOICE_DOCUMENT_EMAIL_METHODS = "POST,OPTIONS";

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

const normalizeTaxRate = (value) => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const normalized = rate > 1 ? rate / 100 : rate;
  return Math.min(Math.max(normalized, 0), 1);
};

const normalizeLineItems = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 200)
    .map((item, index) => {
      const quantity = Math.max(0, normalizeMoney(item?.quantity, 1));
      const unitPrice = Math.max(0, normalizeMoney(item?.unitPrice, 0));
      const total = Math.round(quantity * unitPrice * 100) / 100;
      return {
        id: cleanText(item?.id, 80) || `line-${index + 1}`,
        name: cleanText(item?.name, 240) || `Item ${index + 1}`,
        quantity,
        unitPrice,
        total,
      };
    })
    .filter((item) => item.name);
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

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildSummary = (document) => {
  const lineItems = normalizeLineItems(document?.lineItems);
  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = normalizeTaxRate(document?.taxRate);
  const taxTotal = Math.round(subtotal * taxRate * 100) / 100;
  const grandTotal = Math.round((subtotal + taxTotal) * 100) / 100;
  const rawDeposit = document?.documentType === "invoice" ? Math.max(0, normalizeMoney(document?.depositAmount, 0)) : 0;
  const depositAmount = Math.min(rawDeposit, grandTotal);
  const balanceDue = Math.max(0, Math.round((grandTotal - depositAmount) * 100) / 100);
  return { lineItems, subtotal, taxRate, taxTotal, grandTotal, depositAmount, balanceDue };
};

const buildEmailText = (document, summary, currency) => {
  const lines = [
    `${document.docLabel} ${document.invoiceNumber}`,
    "",
    `Date: ${formatDate(document.issueDate)}`,
    `Status: ${document.paymentStatus || "draft"}`,
    `Customer: ${document.customerName || "Customer"}`,
  ];

  if (document.linkedLabel) {
    lines.push(`Source: ${document.linkedLabel}`);
  }

  lines.push("", "Items:");
  summary.lineItems.forEach((item, index) => {
    lines.push(
      `${index}. ${item.name} | Qty ${item.quantity} | Unit ${formatCurrency(item.unitPrice, currency)} | Total ${formatCurrency(item.total, currency)}`
    );
  });

  lines.push("");
  lines.push(`Subtotal: ${formatCurrency(summary.subtotal, currency)}`);
  if (summary.taxRate > 0) {
    lines.push(`Tax: ${formatCurrency(summary.taxTotal, currency)}`);
  }
  lines.push(`Total: ${formatCurrency(summary.grandTotal, currency)}`);
  if (document.documentType === "invoice") {
    lines.push(`Deposit: ${formatCurrency(summary.depositAmount, currency)}`);
    lines.push(`Balance: ${formatCurrency(summary.balanceDue, currency)}`);
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
  const rows = summary.lineItems
    .map(
      (item, index) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${index}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(item.quantity)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(item.unitPrice, currency))}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(item.total, currency))}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 8px;">${escapeHtml(document.docLabel)} ${escapeHtml(document.invoiceNumber)}</h2>
      <p style="margin:0 0 16px;color:#475569;">Date ${escapeHtml(formatDate(document.issueDate))}</p>
      <div style="margin:0 0 16px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
        <div><strong>Customer:</strong> ${escapeHtml(document.customerName || "Customer")}</div>
        ${document.linkedLabel ? `<div><strong>Source:</strong> ${escapeHtml(document.linkedLabel)}</div>` : ""}
        <div><strong>Status:</strong> ${escapeHtml(document.paymentStatus || "draft")}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">#</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e5e7eb;">Item</th>
            <th style="padding:10px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">Qty</th>
            <th style="padding:10px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">Unit</th>
            <th style="padding:10px 12px;text-align:right;border-bottom:1px solid #e5e7eb;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-left:auto;max-width:320px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;">
        <div style="display:flex;justify-content:space-between;gap:12px;"><span>Subtotal</span><strong>${escapeHtml(formatCurrency(summary.subtotal, currency))}</strong></div>
        ${
          summary.taxRate > 0
            ? `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;"><span>Tax</span><strong>${escapeHtml(formatCurrency(summary.taxTotal, currency))}</strong></div>`
            : ""
        }
        <div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;"><span>Total</span><strong>${escapeHtml(formatCurrency(summary.grandTotal, currency))}</strong></div>
        ${
          document.documentType === "invoice"
            ? `
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;"><span>Deposit</span><strong>${escapeHtml(formatCurrency(summary.depositAmount, currency))}</strong></div>
              <div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;"><span>Balance</span><strong>${escapeHtml(formatCurrency(summary.balanceDue, currency))}</strong></div>
            `
            : ""
        }
      </div>
      ${
        document.notes
          ? `<div style="margin-top:16px;"><strong>Note</strong><p style="margin:6px 0 0;">${escapeHtml(document.notes)}</p></div>`
          : ""
      }
      ${
        document.terms
          ? `<div style="margin-top:16px;"><strong>Terms</strong><p style="margin:6px 0 0;">${escapeHtml(document.terms)}</p></div>`
          : ""
      }
    </div>
  `;
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
    const authResult = await requireInternalUser(client, event, {
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
    const documentType = cleanText(payload.documentType, 20).toLowerCase() === "receipt" ? "receipt" : "invoice";
    const notes = cleanText(payload.notes, 4000);
    const terms = cleanText(payload.terms, 4000);
    const taxRate = normalizeTaxRate(payload.taxRate);
    const depositAmount = Math.max(0, normalizeMoney(payload.depositAmount, 0));
    const lineItems = normalizeLineItems(payload.lineItems);

    if (!to) {
      return respond(event, 400, { error: "Customer email is required." }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
    }
    if (!invoiceNumber) {
      return respond(event, 400, { error: "Document number is required." }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
    }
    if (!lineItems.length) {
      return respond(event, 400, { error: "Add at least one line before sending." }, { methods: INVOICE_DOCUMENT_EMAIL_METHODS });
    }

    const document = {
      docLabel,
      invoiceNumber,
      customerName,
      paymentStatus,
      linkedLabel,
      issueDate,
      documentType,
      notes,
      terms,
      taxRate,
      depositAmount,
      lineItems,
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
