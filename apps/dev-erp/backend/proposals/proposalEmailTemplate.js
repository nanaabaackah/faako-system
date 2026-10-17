import emailKit from "@faako/email-kit";

const {
  EMAIL_THEMES,
  renderButton,
  renderEmailLayout,
  renderKeyValueTable,
  renderList,
  renderMetricGrid,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

const theme = EMAIL_THEMES.faako;

const boundedText = (value, maxLength) => String(value || "").trim().slice(0, maxLength);
const dateLabel = (value) => {
  const date = value instanceof Date ? value : new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
};
const money = (value, currency = "GHS") => new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: String(currency || "GHS").toUpperCase(),
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const commercialMetrics = ({ currency, oneTimeTotal, recurringMonthlyTotal, recurringAnnualTotal, depositAmount }) => [
  { label: "One-time total", value: money(oneTimeTotal, currency) },
  ...(Number(depositAmount || 0) > 0 ? [{ label: "Deposit", value: money(depositAmount, currency) }] : []),
  ...(Number(recurringMonthlyTotal || 0) > 0 ? [{ label: "Monthly", value: money(recurringMonthlyTotal, currency) }] : []),
  ...(Number(recurringAnnualTotal || 0) > 0 ? [{ label: "Annual", value: money(recurringAnnualTotal, currency) }] : []),
];

export const buildProposalDeliveryEmailContent = ({
  recipientName,
  proposalTitle,
  versionNumber,
  reviewUrl,
  validUntil,
  linkExpiresAt,
  currency,
  oneTimeTotal,
  recurringMonthlyTotal,
  recurringAnnualTotal,
  depositAmount,
  providerCharges = [],
  personalMessage,
}) => {
  const name = boundedText(recipientName, 160) || "there";
  const title = boundedText(proposalTitle, 240) || "Your proposal";
  const url = boundedText(reviewUrl, 2000);
  const note = boundedText(personalMessage, 1000);
  const charges = (Array.isArray(providerCharges) ? providerCharges : [])
    .map((entry) => boundedText(entry, 300))
    .filter(Boolean)
    .slice(0, 20);
  const subject = `Your proposal is ready: ${title}`;
  const text = [
    `Hello ${name},`,
    "",
    `Your proposal, ${title} (version ${versionNumber}), is ready to review.`,
    note ? `Message from the Faako team: ${note}` : "",
    "",
    `One-time total: ${money(oneTimeTotal, currency)}`,
    Number(depositAmount || 0) > 0 ? `Deposit: ${money(depositAmount, currency)}` : "",
    Number(recurringMonthlyTotal || 0) > 0 ? `Monthly recurring: ${money(recurringMonthlyTotal, currency)}` : "",
    Number(recurringAnnualTotal || 0) > 0 ? `Annual recurring: ${money(recurringAnnualTotal, currency)}` : "",
    charges.length ? "Third-party provider charges (paid directly):" : "",
    ...charges.map((entry) => `- ${entry}`),
    "",
    `Review proposal: ${url}`,
    `Proposal valid until: ${dateLabel(validUntil)}`,
    `Secure link expires: ${dateLabel(linkExpiresAt)}`,
    "",
    "This secure link is intended for you. Please do not forward it.",
  ].filter(Boolean).join("\n");

  const introHtml = [
    renderParagraphs([
      `Hello ${name},`,
      `We have prepared ${title} for your review. Open the secure proposal to confirm the scope, configure available options, and review the commercial terms.`,
    ], { theme }),
    note ? renderNotice({ title: "A note from the Faako team", lines: [note], theme }) : "",
    `<div style="margin:4px 0 20px;">${renderButton({ href: url, label: "Review proposal", theme })}</div>`,
  ].join("");

  const bodyHtml = [
    renderMetricGrid(commercialMetrics({ currency, oneTimeTotal, recurringMonthlyTotal, recurringAnnualTotal, depositAmount }), { theme }),
    renderPanel({
      theme,
      eyebrow: "Proposal details",
      title: title,
      bodyHtml: renderKeyValueTable([
        ["Version", String(versionNumber)],
        ["Proposal valid until", dateLabel(validUntil)],
        ["Secure link expires", dateLabel(linkExpiresAt)],
      ], { theme }),
    }),
    charges.length ? renderPanel({
      theme,
      eyebrow: "Paid directly to providers",
      title: "Third-party charges",
      bodyHtml: `${renderList(charges, { theme })}${renderParagraphs("These charges are separate from the amounts payable to Faako and remain in the provider's stated currency or pricing terms.", { theme, color: theme.muted, spacing: "8px 0 0" })}`,
    }) : "",
    renderNotice({
      theme,
      title: "Secure client link",
      lines: ["This link is intended for you and may stop working after a newer link is issued.", "If the button does not open, copy and paste the address below:", url],
    }),
  ].join("");

  const html = renderEmailLayout({
    theme,
    preheader: `${title} is ready for your review.`,
    brandName: "Faako",
    brandTagline: "Digital services & systems",
    eyebrow: "Interactive proposal",
    title: "Your proposal is ready",
    subtitle: "Review the scope, services, integrations, pricing, and delivery plan in one secure place.",
    introHtml,
    bodyHtml,
    footerHtml: `<p style="margin:0;color:${theme.muted};font:400 13px/1.65 Arial,sans-serif;">Sent securely by Faako through DEV ERP.</p>`,
  });

  return { subject, text, html };
};

export const buildProposalAcceptanceEmailContent = ({
  recipientName,
  proposalTitle,
  proposalId,
  versionNumber,
  acceptedAt,
  currency,
  oneTimeTotal,
  billingSchedule = [],
}) => {
  const name = boundedText(recipientName, 160) || "there";
  const title = boundedText(proposalTitle, 240) || "Your proposal";
  const schedule = (Array.isArray(billingSchedule) ? billingSchedule : []).slice(0, 30).map((entry) => (
    `${boundedText(entry?.label, 160) || "Payment"}: ${money(entry?.amount, currency)}`
  ));
  const subject = `Proposal accepted: ${title}`;
  const text = [
    `Hello ${name},`, "",
    `Your acceptance of ${title}, proposal #${proposalId}, version ${versionNumber}, was recorded on ${dateLabel(acceptedAt)}.`,
    `Accepted one-time value: ${money(oneTimeTotal, currency)}.`,
    schedule.length ? "Payment schedule:" : "", ...schedule.map((entry) => `- ${entry}`), "",
    "Acceptance is complete. Any invoice will be provided separately after internal review; acceptance does not record a payment.",
  ].filter(Boolean).join("\n");
  const html = renderEmailLayout({
    theme,
    preheader: `Acceptance recorded for ${title}.`,
    brandName: "Faako",
    brandTagline: "Digital services & systems",
    eyebrow: "Acceptance confirmed",
    title: "Thank you — your proposal is accepted",
    subtitle: "Your approved configuration and commercial terms have been preserved as an immutable snapshot.",
    introHtml: renderParagraphs([`Hello ${name},`, `We have recorded your acceptance of ${title}.`], { theme }),
    bodyHtml: [
      renderMetricGrid([{ label: "Accepted value", value: money(oneTimeTotal, currency) }, { label: "Version", value: String(versionNumber) }], { theme }),
      renderPanel({ theme, title: "Acceptance details", bodyHtml: renderKeyValueTable([
        ["Proposal reference", `#${proposalId}`], ["Accepted on", dateLabel(acceptedAt)], ["Status", "Accepted"],
      ], { theme }) }),
      schedule.length ? renderPanel({ theme, title: "Payment schedule", bodyHtml: renderList(schedule, { theme }) }) : "",
      renderNotice({ theme, title: "What happens next", lines: ["The Faako team will review the accepted schedule.", "Any invoice will be issued separately; accepting this proposal does not record a payment."] }),
    ].join(""),
    footerHtml: `<p style="margin:0;color:${theme.muted};font:400 13px/1.65 Arial,sans-serif;">Sent securely by Faako through DEV ERP.</p>`,
  });
  return { subject, text, html };
};
