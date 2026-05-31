import emailKit from "../../../packages/email-kit/src/index.cjs";

const {
  EMAIL_THEMES,
  escapeHtml,
  renderEmailLayout,
  renderKeyValueTable,
  renderMetricGrid,
  renderNotice,
  renderPanel,
  renderParagraphs,
  renderButton,
} = emailKit;

const formatInvoiceCurrency = (amount, currency) =>
  `${currency} ${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const resolveInvoiceDateLabel = (value) => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const MONTHLY_CHARGE_MARKER = "↳ ";
const DEFAULT_QUANTITY_UNIT = "unit";
const DEFAULT_TEMPLATE_BRANDING = {
  senderName: "By Nana",
  headerTagline: "Professional services invoice",
  deliveryLead: "Please find your invoice attached below.",
  introMessage: "Thank you for your business. Please find your invoice details below.",
  supportMessage: "If you have any questions about this invoice, please reply to this email.",
};
const UNIT_SINGULAR_OVERRIDES = {
  hours: "hour",
  days: "day",
  weeks: "week",
  months: "month",
  sessions: "session",
  projects: "project",
  units: "unit",
};

const normalizeQuantityUnit = (value) => {
  const normalized = String(value || DEFAULT_QUANTITY_UNIT).trim();
  return normalized || DEFAULT_QUANTITY_UNIT;
};

const formatQuantityUnit = (quantity, unit) => {
  const normalizedUnit = normalizeQuantityUnit(unit);
  const normalizedQuantity = Number(quantity);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity !== 1) {
    return normalizedUnit;
  }

  const unitOverride = UNIT_SINGULAR_OVERRIDES[normalizedUnit.toLowerCase()];
  if (unitOverride) return unitOverride;
  if (normalizedUnit.endsWith("s")) {
    return normalizedUnit.slice(0, -1);
  }
  return normalizedUnit;
};

const parseInvoiceLineDescription = (rawDescription = "") => {
  const raw = String(rawDescription || "");
  const isMonthlyCharge = raw.startsWith(MONTHLY_CHARGE_MARKER);
  const withoutMarker = isMonthlyCharge
    ? raw.slice(MONTHLY_CHARGE_MARKER.length).trimStart()
    : raw;
  const unitMatch = withoutMarker.match(/\s*\[unit:\s*([^\]]+)\]\s*$/);

  if (!unitMatch) {
    return {
      description: withoutMarker.trim(),
      isMonthlyCharge,
      unit: DEFAULT_QUANTITY_UNIT,
    };
  }

  return {
    description: withoutMarker.slice(0, unitMatch.index).trim(),
    isMonthlyCharge,
    unit: String(unitMatch[1] || "").trim() || DEFAULT_QUANTITY_UNIT,
  };
};

const renderInvoiceLineRows = (lineItems, currency, theme) => {
  if (!lineItems.length) {
    return `<tr><td colspan="4" style="padding:14px 12px;border:1px solid ${theme.border};color:${theme.muted};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">No line items</td></tr>`;
  }

  return lineItems
    .map((lineItem) => {
      const descriptionText = lineItem.description || "Line item";
      const quantityText = `${lineItem.quantity.toLocaleString("en-US")} ${formatQuantityUnit(
        lineItem.quantity,
        lineItem.unit || DEFAULT_QUANTITY_UNIT
      )}`.trim();
      const rowBackground = lineItem.isMonthlyCharge ? theme.accentSoft : theme.surfaceBg;
      const leftPadding = lineItem.isMonthlyCharge ? 28 : 12;

      return `
        <tr>
          <td style="padding:12px 12px 12px ${leftPadding}px;border:1px solid ${theme.border};background:${rowBackground};color:${theme.text};font:400 14px/1.55 Arial,sans-serif;text-align:left;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
            descriptionText
          )}</td>
          <td style="padding:12px;border:1px solid ${theme.border};background:${rowBackground};color:${theme.text};font:400 14px/1.55 Arial,sans-serif;text-align:right;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
            quantityText
          )}</td>
          <td style="padding:12px;border:1px solid ${theme.border};background:${rowBackground};color:${theme.text};font:400 14px/1.55 Arial,sans-serif;text-align:right;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
            formatInvoiceCurrency(lineItem.rate, currency)
          )}</td>
          <td style="padding:12px;border:1px solid ${theme.border};background:${rowBackground};color:${theme.text};font:700 14px/1.55 Arial,sans-serif;text-align:right;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
            formatInvoiceCurrency(lineItem.amount, currency)
          )}</td>
        </tr>
      `.trim();
    })
    .join("");
};

const renderInvoiceLineCards = (lineItems, currency, theme) => {
  if (!lineItems.length) {
    return `
      <div class="email-mobile-card" style="display:none;max-height:0;overflow:hidden;margin:0;padding:14px;border:1px solid ${theme.border};border-radius:16px;background:${theme.surfaceBg};color:${theme.muted};font:400 14px/1.55 Arial,sans-serif;">
        No line items
      </div>
    `.trim();
  }

  return lineItems
    .map((lineItem) => {
      const descriptionText = lineItem.description || "Line item";
      const quantityText = `${lineItem.quantity.toLocaleString("en-US")} ${formatQuantityUnit(
        lineItem.quantity,
        lineItem.unit || DEFAULT_QUANTITY_UNIT
      )}`.trim();
      const cardBackground = lineItem.isMonthlyCharge ? theme.accentSoft : theme.surfaceBg;

      return `
        <div class="email-mobile-card" style="display:none;max-height:0;overflow:hidden;margin:0 0 12px;padding:14px 14px 4px;border:1px solid ${theme.border};border-radius:16px;background:${cardBackground};">
          ${
            lineItem.isMonthlyCharge
              ? `<p style="margin:0 0 8px;color:${theme.accentDark};font:800 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">Monthly charge</p>`
              : ""
          }
          <p style="margin:0 0 10px;color:${theme.heading};font:700 15px/1.45 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
            descriptionText
          )}</p>
          <div style="margin:0 0 10px;">
            <p style="margin:0 0 4px;color:${theme.muted};font:800 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">Qty</p>
            <p style="margin:0;color:${theme.text};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              quantityText
            )}</p>
          </div>
          <div style="margin:0 0 10px;">
            <p style="margin:0 0 4px;color:${theme.muted};font:800 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">Rate</p>
            <p style="margin:0;color:${theme.text};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(lineItem.rate, currency)
            )}</p>
          </div>
          <div style="margin:0 0 10px;">
            <p style="margin:0 0 4px;color:${theme.muted};font:800 11px/1.2 Arial,sans-serif;letter-spacing:0.08em;text-transform:uppercase;">Amount</p>
            <p style="margin:0;color:${theme.heading};font:700 15px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(lineItem.amount, currency)
            )}</p>
          </div>
        </div>
      `.trim();
    })
    .join("");
};

export const buildInvoiceEmailContent = (invoice, templateOptions = {}) => {
  const theme = EMAIL_THEMES.devErp;
  const senderName =
    String(templateOptions?.senderName || DEFAULT_TEMPLATE_BRANDING.senderName).trim() ||
    DEFAULT_TEMPLATE_BRANDING.senderName;
  const headerTagline =
    String(templateOptions?.headerTagline || DEFAULT_TEMPLATE_BRANDING.headerTagline).trim() ||
    DEFAULT_TEMPLATE_BRANDING.headerTagline;
  const deliveryLead =
    String(templateOptions?.deliveryLead || DEFAULT_TEMPLATE_BRANDING.deliveryLead).trim() ||
    DEFAULT_TEMPLATE_BRANDING.deliveryLead;
  const introMessage =
    String(templateOptions?.introMessage || DEFAULT_TEMPLATE_BRANDING.introMessage).trim() ||
    DEFAULT_TEMPLATE_BRANDING.introMessage;
  const supportMessage =
    String(templateOptions?.supportMessage || DEFAULT_TEMPLATE_BRANDING.supportMessage).trim() ||
    DEFAULT_TEMPLATE_BRANDING.supportMessage;
  const closingName =
    String(templateOptions?.closingName || senderName).trim() || senderName;
  const viewInvoiceUrl = templateOptions?.viewInvoiceUrl
    ? String(templateOptions.viewInvoiceUrl).trim()
    : null;
  const isQuotation = Boolean(templateOptions?.isQuotation);

  const rawLineItems = Array.isArray(invoice?.lineItems) ? invoice.lineItems : [];
  const lineItems = rawLineItems.map((lineItem) => {
    const amount = Number(lineItem?.amount ?? 0);
    const quantity = Number(lineItem?.quantity ?? 0);
    const rate = Number(lineItem?.unitPrice ?? 0);
    const { description, isMonthlyCharge, unit } = parseInvoiceLineDescription(lineItem?.description);
    return { amount, quantity, rate, isMonthlyCharge, unit, description };
  });
  const monthlyChargeTotal = lineItems.reduce(
    (acc, lineItem) => (lineItem.isMonthlyCharge ? acc + lineItem.amount : acc),
    0
  );

  const currency = invoice?.currency === "GHS" ? "GHS" : "CAD";
  const subtotal = Number(invoice?.subtotal ?? 0);
  const regularSubtotal = Math.max(subtotal - monthlyChargeTotal, 0);
  const taxRate = Number(invoice?.taxRate ?? 0);
  const taxAmount = Number(invoice?.taxAmount ?? 0);
  const discount = Number(invoice?.discount ?? 0);
  const total = Number(invoice?.total ?? subtotal + taxAmount - discount);
  const paidAmount = Math.max(Number(invoice?.paidAmount ?? 0), 0);
  const balanceDue = Math.max(total - paidAmount, 0);
  const invoiceNumber = invoice?.invoiceNumber || "DRAFT";
  const clientName = invoice?.clientName || "Client";
  const clientEmail = invoice?.clientEmail || "N/A";
  const clientAddress = String(invoice?.clientAddress || "").trim();
  const notes = String(invoice?.notes || "").trim();
  const issueDateLabel = resolveInvoiceDateLabel(invoice?.issueDate);
  const dueDateLabel = resolveInvoiceDateLabel(invoice?.dueDate);
  const paymentPrompt =
    balanceDue <= 0
      ? "Your invoice balance has been settled."
      : dueDateLabel !== "N/A"
      ? `Please arrange payment by ${dueDateLabel}.`
      : "Please arrange payment at your earliest convenience.";
  const notesText = notes ? `Notes: ${notes}` : null;

  const text = [
    `Invoice ${invoiceNumber} from ${senderName}`,
    "",
    `Hello ${clientName},`,
    "",
    deliveryLead,
    isQuotation ? "Use the link below to view and respond to this quotation." : paymentPrompt,
    ...(viewInvoiceUrl ? [`View ${isQuotation ? "quotation" : "invoice"}: ${viewInvoiceUrl}`] : []),
    "",
    "Invoice details",
    `Invoice number: ${invoiceNumber}`,
    `Issue date: ${issueDateLabel}`,
    `Due date: ${dueDateLabel}`,
    `Billing contact: ${clientName}`,
    `Email: ${clientEmail}`,
    ...(clientAddress ? [`Address: ${clientAddress}`] : []),
    "",
    "Line items:",
    ...lineItems.map(
      (lineItem) =>
        `${lineItem.description} | Qty: ${lineItem.quantity.toLocaleString("en-US")} ${formatQuantityUnit(
          lineItem.quantity,
          lineItem.unit || DEFAULT_QUANTITY_UNIT
        )} | Rate: ${formatInvoiceCurrency(
          lineItem.rate,
          currency
        )} | Amount: ${formatInvoiceCurrency(lineItem.amount, currency)}`
    ),
    "",
    `Monthly charges: ${formatInvoiceCurrency(monthlyChargeTotal, currency)}`,
    `Subtotal (excluding monthly charges): ${formatInvoiceCurrency(regularSubtotal, currency)}`,
    `Tax (${taxRate.toFixed(2)}%): ${formatInvoiceCurrency(taxAmount, currency)}`,
    `Discount: -${formatInvoiceCurrency(discount, currency)}`,
    `Total: ${formatInvoiceCurrency(total, currency)}`,
    `Payment received: ${formatInvoiceCurrency(paidAmount, currency)}`,
    `Balance due: ${formatInvoiceCurrency(balanceDue, currency)}`,
    ...(notesText ? ["", notesText] : []),
    "",
    supportMessage,
    "",
    "Thank you,",
    closingName,
  ].join("\n");

  const viewButtonHtml = viewInvoiceUrl
    ? `<div style="margin:0 0 20px;">${renderButton({ href: viewInvoiceUrl, label: isQuotation ? "View & respond to quotation" : "View invoice", theme })}</div>`
    : "";

  const introHtml = [
    renderParagraphs(
      [
        `Hello ${clientName},`,
        introMessage,
        isQuotation ? "Use the button below to view and respond to this quotation." : paymentPrompt,
      ],
      { theme }
    ),
    viewButtonHtml,
  ].join("");

  const summaryHtml = renderMetricGrid(
    [
      { label: "Invoice", value: invoiceNumber },
      { label: "Due date", value: dueDateLabel },
      { label: "Balance due", value: formatInvoiceCurrency(balanceDue, currency) },
    ],
    { theme }
  );

  const detailsHtml = `
    <table class="email-column-table" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0 12px;margin:0 0 18px;">
      <tbody>
        <tr>
          <td class="email-column-cell" style="width:50%;padding-right:10px;vertical-align:top;">
            ${renderPanel({
              theme,
              eyebrow: "Bill to",
              title: clientName,
              bodyHtml: renderKeyValueTable(
                [
                  ["Email", clientEmail],
                  ...(clientAddress ? [["Address", clientAddress]] : []),
                ],
                { theme, labelWidth: "30%" }
              ),
            })}
          </td>
          <td class="email-column-cell" style="width:50%;padding-left:10px;vertical-align:top;">
            ${renderPanel({
              theme,
              eyebrow: "Invoice details",
              title: `Invoice ${invoiceNumber}`,
              bodyHtml: renderKeyValueTable(
                [
                  ["Issue date", issueDateLabel],
                  ["Due date", dueDateLabel],
                  ["Currency", currency],
                  ["Sender", senderName],
                ],
                { theme, labelWidth: "38%" }
              ),
            })}
          </td>
        </tr>
      </tbody>
    </table>
  `.trim();

  const lineItemsHtml = `
    <div class="email-desktop-table" style="display:block;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid ${theme.border};border-radius:18px;overflow:hidden;margin:0 0 18px;table-layout:fixed;">
        <thead>
          <tr>
            <th style="padding:12px;border:1px solid ${theme.border};background:${theme.accentSoft};color:${theme.heading};text-align:left;font:700 13px/1.35 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Description</th>
            <th style="padding:12px;border:1px solid ${theme.border};background:${theme.accentSoft};color:${theme.heading};text-align:right;font:700 13px/1.35 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Qty</th>
            <th style="padding:12px;border:1px solid ${theme.border};background:${theme.accentSoft};color:${theme.heading};text-align:right;font:700 13px/1.35 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Rate</th>
            <th style="padding:12px;border:1px solid ${theme.border};background:${theme.accentSoft};color:${theme.heading};text-align:right;font:700 13px/1.35 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${renderInvoiceLineRows(lineItems, currency, theme)}
        </tbody>
      </table>
    </div>
    <div class="email-mobile-table" style="display:none;max-height:0;overflow:hidden;margin:0 0 18px;">
      ${renderInvoiceLineCards(lineItems, currency, theme)}
    </div>
  `.trim();

  const totalsHtml = renderPanel({
    theme,
    eyebrow: "Totals",
    title: "Invoice summary",
    bodyHtml: `
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr>
            <td style="padding:7px 0;color:${theme.muted};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Monthly charges</td>
            <td style="padding:7px 0;text-align:right;color:${theme.text};font:600 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(monthlyChargeTotal, currency)
            )}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:${theme.muted};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Subtotal (excluding monthly charges)</td>
            <td style="padding:7px 0;text-align:right;color:${theme.text};font:600 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(regularSubtotal, currency)
            )}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:${theme.muted};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Tax (${escapeHtml(
              taxRate.toFixed(2)
            )}%)</td>
            <td style="padding:7px 0;text-align:right;color:${theme.text};font:600 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(taxAmount, currency)
            )}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:${theme.muted};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Discount</td>
            <td style="padding:7px 0;text-align:right;color:${theme.dangerText};font:700 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">-${escapeHtml(
              formatInvoiceCurrency(discount, currency)
            )}</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;border-top:1px solid ${theme.border};color:${theme.heading};font:800 16px/1.4 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Total</td>
            <td style="padding:12px 0 0;border-top:1px solid ${theme.border};text-align:right;color:${theme.heading};font:800 20px/1.4 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(total, currency)
            )}</td>
          </tr>
          <tr>
            <td style="padding:7px 0;color:${theme.muted};font:400 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Payment received</td>
            <td style="padding:7px 0;text-align:right;color:${theme.text};font:600 14px/1.55 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(paidAmount, currency)
            )}</td>
          </tr>
          <tr>
            <td style="padding:12px 0 0;border-top:1px solid ${theme.border};color:${theme.heading};font:800 16px/1.4 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Balance due</td>
            <td style="padding:12px 0 0;border-top:1px solid ${theme.border};text-align:right;color:${theme.heading};font:800 20px/1.4 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(
              formatInvoiceCurrency(balanceDue, currency)
            )}</td>
          </tr>
        </tbody>
      </table>
    `.trim(),
  });

  const notesHtml = notes
    ? renderNotice({
        theme,
        title: "Notes",
        lines: [notes],
      })
    : "";

  const footerHtml = [
    renderParagraphs(supportMessage, { theme, color: theme.muted, spacing: "0 0 10px" }),
    `<p style="margin:0;color:${theme.text};font:400 14px/1.7 Arial,sans-serif;word-break:break-word;overflow-wrap:anywhere;">Thank you,<br /><strong>${escapeHtml(
      closingName
    )}</strong></p>`,
  ].join("");

  const html = renderEmailLayout({
    theme,
    preheader: isQuotation
      ? `Quotation ${invoiceNumber} from ${senderName}. Total ${formatInvoiceCurrency(total, currency)}. Please review and respond.`
      : `Invoice ${invoiceNumber} from ${senderName}. Balance due ${formatInvoiceCurrency(balanceDue, currency)}.`,
    brandName: senderName,
    brandTagline: headerTagline,
    eyebrow: isQuotation ? "Quotation" : "Invoice",
    title: `${isQuotation ? "Quotation" : "Invoice"} ${invoiceNumber}`,
    subtitle: `Prepared for ${clientName}`,
    introHtml,
    bodyHtml: [summaryHtml, detailsHtml, lineItemsHtml, totalsHtml, notesHtml].join(""),
    footerHtml,
  });

  return {
    subject: isQuotation
      ? `Quotation ${invoiceNumber} from ${senderName} — please review`
      : `Invoice ${invoiceNumber} from ${senderName}`,
    text,
    html,
  };
};
