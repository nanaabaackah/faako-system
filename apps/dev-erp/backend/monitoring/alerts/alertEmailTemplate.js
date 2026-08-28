import emailKit from "../../../../../packages/email-kit/src/index.cjs";

const {
  EMAIL_THEMES,
  renderButton,
  renderEmailLayout,
  renderKeyValueTable,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

const EVENT_LABELS = {
  TRIGGERED: "Incident detected",
  REPEATED: "Incident update",
  ESCALATED: "Incident escalated",
  RECOVERED: "Service recovered",
  DELIVERY_FAILED: "Delivery issue",
  SUPPRESSED: "Alert suppressed",
};

const clean = (value, fallback = "") => String(value || "").trim() || fallback;

export const buildMonitoringAlertEmailContent = ({ event, incident, appBaseUrl = "" }) => {
  const theme = EMAIL_THEMES.devErp;
  const eventLabel = EVENT_LABELS[event?.eventType] || "Monitoring update";
  const severity = clean(incident?.severity, "INFO").toUpperCase();
  const status = clean(incident?.status, "UNKNOWN").toUpperCase();
  const title = clean(incident?.title || incident?.summary, "A monitored service needs attention");
  const summary = clean(event?.safeSummary || incident?.summary, "A monitoring event was recorded.");
  const serviceName = clean(incident?.service?.name, `Service ${incident?.serviceId || "unknown"}`);
  const environment = clean(incident?.service?.environment, "Not specified");
  const incidentId = clean(incident?.id, "Unknown");
  const baseUrl = String(appBaseUrl || "").trim().replace(/\/+$/, "");
  const incidentUrl = baseUrl ? `${baseUrl}/system-health?incident=${encodeURIComponent(incidentId)}` : "";
  const isRecovery = event?.eventType === "RECOVERED" || status === "RESOLVED" || status === "CLOSED";
  const subject = `${isRecovery ? "[RECOVERED]" : `[${severity}]`} ${title}`;

  const text = [
    eventLabel,
    "",
    summary,
    "",
    `Incident: #${incidentId}`,
    `Service: ${serviceName}`,
    `Environment: ${environment}`,
    `Status: ${status}`,
    `Severity: ${severity}`,
    incidentUrl ? "" : null,
    incidentUrl ? `Open incident: ${incidentUrl}` : null,
    "",
    "This notification contains operational metadata only. Open Dev ERP for the full incident timeline.",
  ].filter((line) => line !== null).join("\n");

  const introHtml = [
    renderParagraphs(summary, { theme }),
    incidentUrl
      ? `<div style="margin:0 0 18px;">${renderButton({ href: incidentUrl, label: "Open incident in Dev ERP", theme })}</div>`
      : "",
  ].join("");

  const detailsPanel = renderPanel({
    theme,
    eyebrow: eventLabel,
    title,
    bodyHtml: renderKeyValueTable([
      ["Incident", `#${incidentId}`],
      ["Service", serviceName],
      ["Environment", environment],
      ["Status", status],
      ["Severity", severity],
    ], { theme }),
  });

  const safetyNotice = renderNotice({
    theme,
    tone: isRecovery ? "info" : severity === "CRITICAL" ? "danger" : "warning",
    title: isRecovery ? "Recovery recorded" : "Recommended next step",
    lines: isRecovery
      ? ["Confirm the service remains stable before closing the incident."]
      : ["Review the latest checks and incident timeline before taking action."],
  });

  const html = renderEmailLayout({
    theme,
    preheader: `${eventLabel}: ${serviceName} is ${status.toLowerCase()}.`,
    brandName: "Dev ERP Monitoring",
    brandTagline: "Faako platform operations",
    eyebrow: severity,
    title: eventLabel,
    subtitle: `${serviceName} · ${environment}`,
    introHtml,
    bodyHtml: `${detailsPanel}${safetyNotice}`,
    footerHtml: renderParagraphs(
      "Sent by Dev ERP Monitoring for Faako platform operations. Sensitive logs, credentials, and provider payloads are never included in alert email.",
      { theme, color: theme.muted, spacing: "0" },
    ),
  });

  return { subject, text, html };
};
