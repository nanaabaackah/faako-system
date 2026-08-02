import { sanitizeMonitoringDetails, sanitizeText } from "../monitoring.security.js";

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseIncidentId = parseId;
export const parseOptionalId = (value) => value === undefined || value === null || value === "" ? null : parseId(value);

export const parseIncidentFilters = (query = {}) => ({
  status: ["OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"].includes(query.status) ? query.status : null,
  severity: ["INFO", "WARNING", "CRITICAL"].includes(query.severity) ? query.severity : null,
  serviceId: parseOptionalId(query.serviceId),
  assignedUserId: parseOptionalId(query.assignedUserId),
  take: Math.min(Math.max(Number(query.take) || 100, 1), 200),
});

export const parseNotePayload = (body = {}) => {
  const note = sanitizeText(body.note, 2000);
  if (!note || note.length < 2) throw Object.assign(new Error("A note is required."), { status: 400 });
  return { note };
};

export const parseAssignmentPayload = (body = {}) => {
  const assignedUserId = parseOptionalId(body.assignedUserId);
  const assignedRoleId = parseOptionalId(body.assignedRoleId);
  if (!assignedUserId && !assignedRoleId) throw Object.assign(new Error("An active user or role assignment is required."), { status: 400 });
  if (assignedUserId && assignedRoleId) throw Object.assign(new Error("Assign either a user or a role, not both."), { status: 400 });
  return { assignedUserId, assignedRoleId };
};

export const parseResolutionPayload = (body = {}) => {
  const resolutionSummary = sanitizeText(body.resolutionSummary || body.note, 2000);
  if (!resolutionSummary || resolutionSummary.length < 3) throw Object.assign(new Error("A resolution summary is required."), { status: 400 });
  return {
    resolutionSummary,
    rootCause: sanitizeText(body.rootCause, 2000),
    impactSummary: sanitizeText(body.impactSummary, 2000),
  };
};

export const parseIncidentUpdatePayload = (body = {}) => ({
  title: sanitizeText(body.title, 180),
  impactSummary: sanitizeText(body.impactSummary, 2000),
  rootCause: sanitizeText(body.rootCause, 2000),
  metadata: sanitizeMonitoringDetails(body.metadata),
});

export const parseExportFormat = (value) => String(value || "pdf").toLowerCase() === "csv" ? "csv" : "pdf";
