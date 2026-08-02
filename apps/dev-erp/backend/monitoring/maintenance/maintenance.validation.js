import { sanitizeText } from "../monitoring.security.js";

const CATEGORIES = new Set(["BUSINESS", "API", "DATABASE", "INFRASTRUCTURE", "EXTERNAL", "WORKER"]);
const id = (value) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; };

export const parseMaintenancePayload = (body = {}, { partial = false } = {}) => {
  const name = sanitizeText(body.name, 160);
  if (!partial && !name) throw Object.assign(new Error("Maintenance window name is required."), { status: 400 });
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (!partial && (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()))) throw Object.assign(new Error("Valid maintenance start and end times are required."), { status: 400 });
  if (startsAt && endsAt && (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 90 * 24 * 60 * 60 * 1000)) throw Object.assign(new Error("Maintenance must end after it starts and cannot exceed 90 days."), { status: 400 });
  const serviceId = body.serviceId === undefined ? undefined : id(body.serviceId);
  const category = body.category ? String(body.category).toUpperCase() : null;
  if (category && !CATEGORIES.has(category)) throw Object.assign(new Error("Maintenance category is invalid."), { status: 400 });
  const environment = body.environment ? String(body.environment).toLowerCase() : null;
  if (environment && !["development", "production"].includes(environment)) throw Object.assign(new Error("Environment must be development or production."), { status: 400 });
  if (!partial && !serviceId && !category && !environment) throw Object.assign(new Error("Maintenance must target a service, category, or environment."), { status: 400 });
  return Object.fromEntries(Object.entries({ name, reason: sanitizeText(body.reason, 1000), serviceId, category, environment, startsAt, endsAt, suppressAlerts: body.suppressAlerts === undefined ? undefined : Boolean(body.suppressAlerts) }).filter(([, value]) => value !== undefined && value !== null));
};
