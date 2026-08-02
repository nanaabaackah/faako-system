import { sanitizeText } from "../monitoring.security.js";
import { ALERT_SEVERITIES, ALERT_TRIGGER_TYPES, CHANNEL_TYPES } from "./alert.constants.js";

const CATEGORIES = new Set(["BUSINESS", "API", "DATABASE", "INFRASTRUCTURE", "EXTERNAL", "WORKER"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const id = (value) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : null; };
const integer = (value, fallback, min, max) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback; };

export const parseAlertRulePayload = (body = {}, { partial = false } = {}) => {
  const name = sanitizeText(body.name, 160);
  const triggerType = String(body.triggerType || "").toUpperCase();
  const severity = body.severity === undefined && partial ? "" : String(body.severity || "WARNING").toUpperCase();
  if (!partial && !name) throw Object.assign(new Error("Alert rule name is required."), { status: 400 });
  if (!partial && !ALERT_TRIGGER_TYPES.has(triggerType)) throw Object.assign(new Error("Alert trigger type is invalid."), { status: 400 });
  if (body.triggerType !== undefined && !ALERT_TRIGGER_TYPES.has(triggerType)) throw Object.assign(new Error("Alert trigger type is invalid."), { status: 400 });
  if (body.severity !== undefined && !ALERT_SEVERITIES.has(severity)) throw Object.assign(new Error("Alert severity is invalid."), { status: 400 });
  const environment = body.environment === undefined ? partial ? undefined : null : body.environment === null || body.environment === "" ? null : String(body.environment).toLowerCase();
  if (environment && !["development", "production"].includes(environment)) throw Object.assign(new Error("Environment must be development or production."), { status: 400 });
  const category = body.category === undefined && partial ? undefined : body.category ? String(body.category).toUpperCase() : null;
  if (category && !CATEGORIES.has(category)) throw Object.assign(new Error("Monitoring category is invalid."), { status: 400 });
  const thresholdValue = body.thresholdValue === undefined ? partial ? undefined : null : body.thresholdValue === null || body.thresholdValue === "" ? null : Number(body.thresholdValue);
  if (thresholdValue !== null && (!Number.isFinite(thresholdValue) || thresholdValue < 0 || thresholdValue > 1_000_000)) throw Object.assign(new Error("Alert threshold is invalid."), { status: 400 });
  const data = {
    ...(name ? { name } : {}), ...(triggerType ? { triggerType } : {}), ...(severity ? { severity } : {}),
    serviceId: body.serviceId === undefined ? undefined : id(body.serviceId), category, environment, thresholdValue,
    consecutiveFailures: body.consecutiveFailures === undefined ? undefined : integer(body.consecutiveFailures, null, 1, 100),
    cooldownMinutes: body.cooldownMinutes === undefined ? undefined : integer(body.cooldownMinutes, 15, 1, 10080),
    recoveryNotifications: body.recoveryNotifications === undefined ? undefined : Boolean(body.recoveryNotifications),
    escalationPolicyId: body.escalationPolicyId === undefined ? undefined : id(body.escalationPolicyId),
    channelIds: Array.isArray(body.channelIds) ? [...new Set(body.channelIds.map(id).filter(Boolean))].slice(0, 20) : undefined,
  };
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
};

export const parseChannelPayload = (body = {}, { partial = false, whatsappEnabled = false, webhookEnabled = false } = {}) => {
  const name = sanitizeText(body.name, 120);
  const type = String(body.type || "").toUpperCase();
  if (!partial && !name) throw Object.assign(new Error("Channel name is required."), { status: 400 });
  if (!partial && !CHANNEL_TYPES.has(type)) throw Object.assign(new Error("Channel type is invalid."), { status: 400 });
  if (body.type !== undefined && !CHANNEL_TYPES.has(type)) throw Object.assign(new Error("Channel type is invalid."), { status: 400 });
  if (type === "WHATSAPP" && !whatsappEnabled) throw Object.assign(new Error("WhatsApp monitoring delivery is not enabled."), { status: 409 });
  if (type === "WEBHOOK" && !webhookEnabled) throw Object.assign(new Error("Webhook monitoring delivery is not enabled."), { status: 409 });
  const config = body.config && typeof body.config === "object" && !Array.isArray(body.config) ? body.config : partial ? undefined : {};
  if (type === "EMAIL") {
    const recipients = Array.isArray(config?.recipients) ? config.recipients.map((value) => String(value).trim().toLowerCase()).filter((value) => EMAIL_PATTERN.test(value)).slice(0, 20) : [];
    if (!partial && !recipients.length) throw Object.assign(new Error("At least one valid email recipient is required."), { status: 400 });
    return { ...(name ? { name } : {}), ...(type ? { type } : {}), enabled: body.enabled === undefined ? undefined : Boolean(body.enabled), config: config === undefined ? undefined : { recipients }, safeDisplay: recipients.length ? `${recipients.length} email recipient${recipients.length === 1 ? "" : "s"}` : undefined };
  }
  return { ...(name ? { name } : {}), ...(type ? { type } : {}), enabled: body.enabled === undefined ? undefined : Boolean(body.enabled), config, safeDisplay: type ? type === "IN_APP" ? "Dev ERP in-app notifications" : `${type} configuration protected` : undefined };
};

export const parseEscalationPolicyPayload = (body = {}) => {
  const name = sanitizeText(body.name, 160);
  if (!name) throw Object.assign(new Error("Escalation policy name is required."), { status: 400 });
  const steps = Array.isArray(body.steps) ? body.steps.slice(0, 12).map((step, index) => {
    const targetType = String(step.targetType || "").toUpperCase();
    if (!["USER", "ROLE", "CHANNEL"].includes(targetType)) throw Object.assign(new Error("Escalation target type is invalid."), { status: 400 });
    const targetUserId = id(step.targetUserId); const targetRoleId = id(step.targetRoleId); const targetChannelId = id(step.targetChannelId);
    if ((targetType === "USER" && !targetUserId) || (targetType === "ROLE" && !targetRoleId) || (targetType === "CHANNEL" && !targetChannelId)) throw Object.assign(new Error("Escalation target is required."), { status: 400 });
    return { position: index + 1, delayMinutes: integer(step.delayMinutes, 0, 0, 43200), targetType, targetUserId, targetRoleId, targetChannelId, stopOnAcknowledge: Boolean(step.stopOnAcknowledge) };
  }) : [];
  if (!steps.length) throw Object.assign(new Error("At least one escalation step is required."), { status: 400 });
  return { name, enabled: body.enabled !== false, stopOnAcknowledge: Boolean(body.stopOnAcknowledge), steps };
};
