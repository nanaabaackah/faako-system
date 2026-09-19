export const normalizeGhanaPhone = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return `+233${digits.slice(1)}`;
  if (/^233\d{9}$/.test(digits)) return `+${digits}`;
  if (raw.startsWith("+") && /^\d{8,15}$/.test(digits)) return `+${digits}`;
  return "";
};
