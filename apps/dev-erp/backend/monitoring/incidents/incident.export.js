import { jsPDF } from "jspdf";
import { sanitizeMonitoringDetails, sanitizeText } from "../monitoring.security.js";

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const safeDate = (value) => value ? new Date(value).toISOString() : "";

export const buildIncidentCsv = (incident) => {
  const rows = [
    ["Incident ID", incident.id], ["Title", incident.title || incident.summary], ["Service", incident.service?.name],
    ["Environment", incident.service?.environment], ["Severity", incident.severity], ["Status", incident.status],
    ["Started", safeDate(incident.startedAt)], ["Acknowledged", safeDate(incident.acknowledgedAt)],
    ["Recovered", safeDate(incident.recoveredAt)], ["Resolved", safeDate(incident.resolvedAt)],
    ["Closed", safeDate(incident.closedAt)], ["Impact", sanitizeText(incident.impactSummary, 2000)],
    ["Root cause", sanitizeText(incident.rootCause, 2000)], ["Resolution", sanitizeText(incident.resolutionSummary, 2000)],
    [], ["Timeline time", "Type", "Actor", "Summary"],
    ...(incident.timeline || []).map((entry) => [safeDate(entry.createdAt), entry.type, entry.actorLabel || "System", sanitizeText(entry.summary, 500)]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
};

export const buildIncidentPdf = (incident) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const lines = [
    `Incident #${incident.id}: ${sanitizeText(incident.title || incident.summary, 160) || "Monitoring incident"}`,
    `Service: ${incident.service?.name || "Unknown"} (${incident.service?.environment || "unknown"})`,
    `Severity: ${incident.severity}    Status: ${incident.status}`,
    `Started: ${safeDate(incident.startedAt)}`,
    `Acknowledged: ${safeDate(incident.acknowledgedAt) || "Not acknowledged"}`,
    `Resolved: ${safeDate(incident.resolvedAt) || "Not resolved"}`,
    `Impact: ${sanitizeText(incident.impactSummary, 1000) || "Not recorded"}`,
    `Root cause: ${sanitizeText(incident.rootCause, 1000) || "Not recorded"}`,
    `Resolution: ${sanitizeText(incident.resolutionSummary, 1000) || "Not recorded"}`,
    "Timeline:",
    ...(incident.timeline || []).map((entry) => `${safeDate(entry.createdAt)} | ${entry.type} | ${sanitizeText(entry.summary, 240) || ""}`),
  ];
  let y = 48;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  lines.forEach((line, index) => {
    const wrapped = doc.splitTextToSize(line, 500);
    if (y + wrapped.length * 14 > 790) { doc.addPage(); y = 48; }
    if (index === 0) { doc.setFontSize(15); doc.setFont("helvetica", "bold"); }
    doc.text(wrapped, 48, y);
    y += wrapped.length * 14 + 5;
    if (index === 0) { doc.setFontSize(10); doc.setFont("helvetica", "normal"); }
  });
  return Buffer.from(doc.output("arraybuffer"));
};

export const toSafeExportIncident = (incident) => ({
  ...incident,
  metadata: sanitizeMonitoringDetails(incident.metadata),
  alertEvents: (incident.alertEvents || []).map(({ id, eventType, deliveryStatus, safeSummary, createdAt, deliveredAt }) => ({ id, eventType, deliveryStatus, safeSummary, createdAt, deliveredAt })),
});
