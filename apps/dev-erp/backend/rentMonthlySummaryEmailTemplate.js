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

export const buildRentMonthlySummaryEmailContent = ({
  summary,
  monthLabel,
  organizationName,
  templateOptions = {},
  contentOptions = {},
}) => {
  const theme = EMAIL_THEMES.devErp;
  const subjectPrefix =
    String(templateOptions?.subjectPrefix || "Rent monthly summary").trim() ||
    "Rent monthly summary";
  const heading =
    String(templateOptions?.heading || "Rent monthly summary").trim() || "Rent monthly summary";
  const introText =
    String(templateOptions?.introText || "").trim();
  const footerText =
    String(templateOptions?.footerText || "Please review this summary and reply if anything looks incorrect.").trim() ||
    "Please review this summary and reply if anything looks incorrect.";
  const subject = `${subjectPrefix} • ${summary.tenantName} • ${monthLabel}`;
  const orgLabel = String(organizationName || "").trim();
  const missedPeriods = Number(summary.periodsMissed || 0);

  const detailRows = [
    ...(contentOptions.tenantEmail !== false ? [["Email", summary.tenantEmail || "N/A"]] : []),
    ...(contentOptions.leaseDates !== false
      ? [
          ["From", summary.leaseStartDate ? summary.leaseStartDate.slice(0, 10) : "N/A"],
          ["To", summary.leaseEndDate ? summary.leaseEndDate.slice(0, 10) : "Open-ended"],
        ]
      : []),
  ];

  const metricItems = [
    ...(contentOptions.monthlyRent !== false
      ? [{ label: "Monthly rent", value: formatMoney(summary.monthlyRent, summary.currency) }]
      : []),
    ...(contentOptions.paidThisMonth !== false
      ? [{ label: "Paid this month", value: formatMoney(summary.paidThisMonth, summary.currency) }]
      : []),
    ...(contentOptions.outstandingThisMonth !== false
      ? [{ label: "Outstanding", value: formatMoney(summary.outstandingThisMonth, summary.currency) }]
      : []),
    ...(contentOptions.periodsMissed !== false
      ? [{ label: "Missed periods", value: String(missedPeriods) }]
      : []),
  ];

  const text = [
    `${heading} for ${summary.tenantName}`,
    "",
    orgLabel ? `Organization: ${orgLabel}` : null,
    `Month: ${monthLabel}`,
    contentOptions.tenantEmail !== false ? `Email: ${summary.tenantEmail || "N/A"}` : null,
    introText ? "" : null,
    introText || null,
    "",
    contentOptions.monthlyRent !== false
      ? `Monthly rent: ${formatMoney(summary.monthlyRent, summary.currency)}`
      : null,
    contentOptions.paidThisMonth !== false
      ? `Paid this month: ${formatMoney(summary.paidThisMonth, summary.currency)}`
      : null,
    contentOptions.expectedThisMonth !== false
      ? `Expected this month: ${formatMoney(summary.expectedThisMonth, summary.currency)}`
      : null,
    contentOptions.outstandingThisMonth !== false
      ? `Outstanding this month: ${formatMoney(summary.outstandingThisMonth, summary.currency)}`
      : null,
    contentOptions.outstandingYear !== false
      ? `Total Year-end balance: ${formatMoney(summary.outstandingYear, summary.currency)}`
      : null,
    contentOptions.periodsMissed !== false ? `Missed periods: ${missedPeriods}` : null,
    "",
    contentOptions.leaseDates !== false
      ? `Lease start: ${summary.leaseStartDate ? summary.leaseStartDate.slice(0, 10) : "N/A"}`
      : null,
    contentOptions.leaseDates !== false
      ? `Lease end: ${summary.leaseEndDate ? summary.leaseEndDate.slice(0, 10) : "Open-ended"}`
      : null,
    "",
    footerText,
  ]
    .filter(Boolean)
    .join("\n");

  const introHtml = renderParagraphs(
    [
      introText || `This summary shows the current rent position for ${summary.tenantName} in ${monthLabel}.`,
    ],
    { theme }
  );

  const balancePanel = renderPanel({
    theme,
    eyebrow: "Balance overview",
    title: `${summary.tenantName} • ${monthLabel}`,
    bodyHtml: [
      renderMetricGrid(metricItems, { theme }),
      renderKeyValueTable(
        [
          ...(contentOptions.expectedThisMonth !== false
            ? [["Expected this month", formatMoney(summary.expectedThisMonth, summary.currency)]]
            : []),
          ...(contentOptions.outstandingYear !== false
            ? [["Total Year-end balance", formatMoney(summary.outstandingYear, summary.currency)]]
            : []),
        ],
        { theme, labelWidth: "42%" }
      ),
    ].join(""),
  });

  const detailsPanel = detailRows.length
    ? renderPanel({
        theme,
        eyebrow: "Rent tracker",
        title: "Details",
        bodyHtml: renderKeyValueTable(detailRows, { theme, labelWidth: "34%" }),
      })
    : "";

  const footerHtml = [
    renderParagraphs(footerText, { theme, color: theme.muted, spacing: "0 0 10px" }),
    `<p style="margin:0;color:${theme.muted};font:400 13px/1.65 Arial,sans-serif;">Generated from the rent tracker.</p>`,
  ].join("");

  const html = renderEmailLayout({
    theme,
    preheader: `${heading} for ${summary.tenantName} in ${monthLabel}.`,
    brandName: "Rent Tracker",
    brandTagline: "Payment visibility",
    eyebrow: "Monthly summary",
    title: heading,
    subtitle: `${summary.tenantName} • ${monthLabel}`,
    introHtml,
    bodyHtml: [balancePanel, detailsPanel].join(""),
    footerHtml,
  });

  return { subject, text, html };
};
