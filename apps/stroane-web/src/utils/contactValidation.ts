export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_INPUT_PATTERN = "\\+?[0-9][0-9\\s().-]{6,24}";

export const isLikelyEmail = (value = "") => EMAIL_PATTERN.test(value.trim());

export const isLikelyPhone = (value = "") => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!new RegExp(`^${PHONE_INPUT_PATTERN}$`).test(trimmed)) return false;

  const digits = trimmed.replace(/\D/g, "");
  return /^\d{7,15}$/.test(digits);
};
