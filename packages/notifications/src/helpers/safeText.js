const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const sanitizeNotificationText = (value = "", { maxLength = 500 } = {}) => {
  const normalized = String(value ?? "")
    .replace(CONTROL_CHARACTER_PATTERN, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();

  if (!maxLength || normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

export const compactNotificationLines = (lines = [], options = {}) =>
  (Array.isArray(lines) ? lines : [])
    .map((line) => sanitizeNotificationText(line, options))
    .filter(Boolean)
    .join("\n");

export const formatSafeReference = (value = "") =>
  sanitizeNotificationText(value, { maxLength: 80 });

export const formatSafeCustomerName = (value = "") =>
  sanitizeNotificationText(value, { maxLength: 80 }) || "Customer";
