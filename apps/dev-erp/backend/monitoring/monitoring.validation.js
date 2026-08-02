import { MONITORING_CATEGORIES, MONITORING_CHECK_TYPES, TIMELINE_RANGES } from "./monitoring.constants.js";

export const parseServiceId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseTimelineRange = (value) => (
  Object.prototype.hasOwnProperty.call(TIMELINE_RANGES, value) ? value : "24h"
);

export const validateRegistryEntry = (service) => {
  const errors = [];
  if (!service?.key || !/^[a-z0-9][a-z0-9-]{1,79}$/.test(service.key)) errors.push("invalid key");
  if (!String(service?.name || "").trim()) errors.push("missing name");
  if (!MONITORING_CATEGORIES.includes(service?.category)) errors.push("invalid category");
  if (!MONITORING_CHECK_TYPES.includes(service?.checkType)) errors.push("invalid check type");
  if (!Number.isInteger(service?.intervalSeconds) || service.intervalSeconds < 30) errors.push("invalid interval");
  if (!Number.isInteger(service?.timeoutMs) || service.timeoutMs < 250 || service.timeoutMs > 30000) errors.push("invalid timeout");
  if (!Number.isInteger(service?.retryCount) || service.retryCount < 0 || service.retryCount > 3) errors.push("invalid retry count");
  return errors;
};

export const validateRegistry = (services) => {
  const keys = new Set();
  const errors = [];
  services.forEach((service) => {
    const entryErrors = validateRegistryEntry(service);
    if (keys.has(service.key)) entryErrors.push("duplicate key");
    keys.add(service.key);
    if (entryErrors.length) errors.push({ key: service.key || "unknown", errors: entryErrors });
  });
  return errors;
};
