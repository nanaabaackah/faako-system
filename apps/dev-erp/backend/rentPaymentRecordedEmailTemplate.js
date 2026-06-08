import emailKit from "../../../packages/email-kit/src/index.cjs";
import { formatAmountAsGhs } from "./utils/displayCurrency.js";

const {
  EMAIL_THEMES,
  renderEmailLayout,
  renderKeyValueTable,
  renderMetricGrid,
  renderPanel,
  renderParagraphs,
} = emailKit;

const formatMoney = (amount, currency) => formatAmountAsGhs(amount, currency);

export const buildRentPaymentRecordedEmailContent = ({
  summary,
  payment,
  paymentMonthLabel,
  templateOptions = {},
  contentOptions = {},
}) => {
  const theme = EMAIL_THEMES.devErp;
  const subjectPrefix =
    String(templateOptions?.subjectPrefix || "Rent payment recorded").trim() ||
    "Rent payment recorded";
  const heading =
    String(templateOptions?.heading || "Rent payment recorded").trim() || "Rent payment recorded";
  const introText = String(templateOptions?.introText || "").trim();
  const footerText =
    String(
      templateOptions?.footerText ||
        "This notification confirms the payment currently recorded in the rent tracker."
    ).trim() || "This notification confirms the payment currently recorded in the rent tracker.";
  const paymentDateLabel = payment?.paidAt ? String(payment.paidAt).slice(0, 10) : "N/A";
  const yearEndLabel = summary.yearEndProjectionLabel || "Year end";
  const subject = `${subjectPrefix} • ${summary.tenantName} • ${paymentMonthLabel}`;

  const text = [
    `${heading} for ${summary.tenantName}`,
    "",
    contentOptions.paymentMonth !== false ? `Payment month: ${paymentMonthLabel}` : null,
    contentOptions.paymentDate !== false ? `Payment date: ${paymentDateLabel}` : null,
    contentOptions.amountReceived !== false
      ? `Amount received: ${formatMoney(payment.amount, payment.currency)}`
      : null,
    introText ? "" : null,
    introText || null,
    "",
    contentOptions.paymentDetails !== false && payment.method ? `Method: ${payment.method}` : null,
    contentOptions.paymentDetails !== false && payment.reference
      ? `Reference: ${payment.reference}`
      : null,
    contentOptions.paymentDetails !== false && payment.notes ? `Notes: ${payment.notes}` : null,
    "",
    contentOptions.monthlyRent !== false
      ? `Monthly rent: ${formatMoney(summary.monthlyRent, summary.currency)}`
      : null,
    contentOptions.paidThisMonth !== false
      ? `Paid this month: ${formatMoney(summary.paidThisMonth, summary.currency)}`
      : null,
    contentOptions.outstandingThisMonth !== false
      ? `Outstanding this month: ${formatMoney(summary.outstandingThisMonth, summary.currency)}`
      : null,
    contentOptions.yearEndOutstanding !== false
      ? `${yearEndLabel}: ${formatMoney(summary.outstandingYear, summary.currency)}`
      : null,
    contentOptions.periodsMissed !== false ? `Missed periods: ${summary.periodsMissed}` : null,
    "",
    footerText,
  ]
    .filter(Boolean)
    .join("\n");

  const introHtml = renderParagraphs(
    introText || `A payment has been recorded for ${summary.tenantName} in ${paymentMonthLabel}.`,
    { theme }
  );

  const paymentPanel = renderPanel({
    theme,
    eyebrow: "Payment received",
    title: `${summary.tenantName} • ${paymentMonthLabel}`,
    bodyHtml: [
      renderMetricGrid(
        [
          ...(contentOptions.amountReceived !== false
            ? [{ label: "Amount received", value: formatMoney(payment.amount, payment.currency) }]
            : []),
          ...(contentOptions.paymentDate !== false
            ? [{ label: "Payment date", value: paymentDateLabel }]
            : []),
          ...(contentOptions.paymentMonth !== false
            ? [{ label: "Payment month", value: paymentMonthLabel }]
            : []),
        ],
        { theme }
      ),
      renderKeyValueTable(
        [
          ...(contentOptions.paymentDetails !== false && payment.method ? [["Method", payment.method]] : []),
          ...(contentOptions.paymentDetails !== false && payment.reference ? [["Reference", payment.reference]] : []),
          ...(contentOptions.paymentDetails !== false && payment.notes ? [["Notes", payment.notes]] : []),
        ],
        { theme, labelWidth: "34%" }
      ),
    ].join(""),
  });

  const balancePanel = renderPanel({
    theme,
    eyebrow: "Updated balance",
    title: "Rent position",
    bodyHtml: [
      renderMetricGrid(
        [
          ...(contentOptions.monthlyRent !== false
            ? [{ label: "Monthly rent", value: formatMoney(summary.monthlyRent, summary.currency) }]
            : []),
          ...(contentOptions.paidThisMonth !== false
            ? [{ label: "Paid this month", value: formatMoney(summary.paidThisMonth, summary.currency) }]
            : []),
          ...(contentOptions.outstandingThisMonth !== false
            ? [{ label: "Outstanding", value: formatMoney(summary.outstandingThisMonth, summary.currency) }]
            : []),
        ],
        { theme }
      ),
      renderKeyValueTable(
        [
          ...(contentOptions.yearEndOutstanding !== false
            ? [[yearEndLabel, formatMoney(summary.outstandingYear, summary.currency)]]
            : []),
          ...(contentOptions.periodsMissed !== false
            ? [["Missed periods", String(summary.periodsMissed || 0)]]
            : []),
        ],
        { theme, labelWidth: "40%" }
      ),
    ].join(""),
  });

  const footerHtml = [
    renderParagraphs(footerText, { theme, color: theme.muted, spacing: "0 0 10px" }),
    `<p style="margin:0;color:${theme.muted};font:400 13px/1.65 Arial,sans-serif;">Generated from the rent tracker.</p>`,
  ].join("");

  const html = renderEmailLayout({
    theme,
    preheader: `${heading} for ${summary.tenantName} in ${paymentMonthLabel}.`,
    brandName: "Rent tracker",
    brandTagline: "Recorded payment update",
    eyebrow: "Payment confirmation",
    title: heading,
    subtitle: `${summary.tenantName} • ${paymentMonthLabel}`,
    introHtml,
    bodyHtml: [paymentPanel, balancePanel].join(""),
    footerHtml,
  });

  return { subject, text, html };
};
