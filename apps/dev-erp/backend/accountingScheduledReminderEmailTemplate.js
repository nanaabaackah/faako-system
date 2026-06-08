import emailKit from "../../../packages/email-kit/src/index.cjs";
import { formatAmountAsGhs } from "./utils/displayCurrency.js";

const {
  EMAIL_THEMES,
  renderDataTable,
  renderEmailLayout,
  renderMetricGrid,
  renderPanel,
  renderParagraphs,
} = emailKit;

const formatMoney = (amount, currency) => formatAmountAsGhs(amount, currency);

const formatUtcDateLabel = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

export const buildAccountingScheduledReminderEmailContent = ({
  entries,
  dueDate,
  organizationName,
  daysUntilDue = 2,
  templateOptions = {},
  contentOptions = {},
}) => {
  const theme = EMAIL_THEMES.devErp;
  const dueDateLabel = formatUtcDateLabel(dueDate);
  const orgLabel = String(organizationName || "").trim();
  const normalizedEntries = Array.isArray(entries) ? entries : [];
  const subjectPrefix =
    String(templateOptions?.subjectPrefix || "Upcoming scheduled payment reminder").trim() ||
    "Upcoming scheduled payment reminder";
  const heading =
    String(templateOptions?.heading || "Upcoming scheduled payment reminder").trim() ||
    "Upcoming scheduled payment reminder";
  const introText =
    String(
      templateOptions?.introText ||
        "The following scheduled accounting entries are due soon. Please review them before the due date."
    ).trim() ||
    "The following scheduled accounting entries are due soon. Please review them before the due date.";
  const footerText =
    String(templateOptions?.footerText || "Please review these scheduled payments before the due date.").trim() ||
    "Please review these scheduled payments before the due date.";
  const subject = `${subjectPrefix} • ${orgLabel || "Accounting"} • ${dueDateLabel}`;

  const textLines = [
    `${heading} for ${orgLabel || "your organization"}`,
    "",
    contentOptions.dueDate !== false ? `Due date: ${dueDateLabel}` : null,
    contentOptions.reminderWindow !== false
      ? `Reminder window: ${daysUntilDue} days before due date`
      : null,
    "",
    introText,
    "",
    ...normalizedEntries.flatMap((entry, index) => [
      `${index + 1}. ${entry.serviceName || "Scheduled payment"}`,
      `   Amount: ${formatMoney(entry.amount, entry.currency)}`,
      contentOptions.recurrence !== false && entry.recurringInterval
        ? `   Recurrence: ${entry.recurringInterval}`
        : null,
      contentOptions.notes !== false && entry.detail ? `   Notes: ${entry.detail}` : null,
      "",
    ]),
    footerText,
  ].filter(Boolean);

  const columnDefinitions = [
    { key: "service", label: "Service", enabled: true },
    { key: "amount", label: "Amount", enabled: true },
    {
      key: "recurrence",
      label: "Recurrence",
      enabled: contentOptions.recurrence !== false,
    },
    {
      key: "notes",
      label: "Notes",
      enabled: contentOptions.notes !== false,
    },
  ].filter((column) => column.enabled);

  const tableRows = normalizedEntries.map((entry) =>
    columnDefinitions.map((column) => {
      if (column.key === "service") return entry.serviceName || "Scheduled payment";
      if (column.key === "amount") return formatMoney(entry.amount, entry.currency);
      if (column.key === "recurrence") return entry.recurringInterval || "One-time";
      return entry.detail || "—";
    })
  );

  const introHtml = renderParagraphs(introText, { theme });

  const summaryPanel = renderPanel({
    theme,
    eyebrow: orgLabel || "Accounting",
    title: heading,
    bodyHtml: renderMetricGrid(
      [
        ...(contentOptions.dueDate !== false ? [{ label: "Due date", value: dueDateLabel }] : []),
        ...(contentOptions.reminderWindow !== false
          ? [{ label: "Reminder window", value: `${daysUntilDue} days` }]
          : []),
        { label: "Entries", value: String(normalizedEntries.length) },
      ],
      { theme }
    ),
  });

  const tablePanel = renderPanel({
    theme,
    title: "Scheduled entries",
    bodyHtml: renderDataTable({
      theme,
      headers: columnDefinitions.map((column) => column.label),
      rows: tableRows,
      aligns: columnDefinitions.map((column) => (column.key === "amount" ? "right" : "left")),
    }),
  });

  const footerHtml = [
    renderParagraphs(footerText, { theme, color: theme.muted, spacing: "0 0 10px" }),
    `<p style="margin:0;color:${theme.muted};font:400 13px/1.65 Arial,sans-serif;">Generated from the accounting scheduler.</p>`,
  ].join("");

  const html = renderEmailLayout({
    theme,
    preheader: `${heading} for ${orgLabel || "Accounting"} due ${dueDateLabel}.`,
    brandName: orgLabel || "Accounting",
    brandTagline: "Scheduled payment reminder",
    eyebrow: "Scheduled reminder",
    title: heading,
    subtitle: `Due ${dueDateLabel}`,
    introHtml,
    bodyHtml: [summaryPanel, tablePanel].join(""),
    footerHtml,
  });

  return {
    subject,
    text: textLines.join("\n"),
    html,
  };
};
