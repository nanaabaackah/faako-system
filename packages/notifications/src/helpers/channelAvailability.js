import { NOTIFICATION_CHANNELS } from "../constants/channels.js";
import { sanitizeNotificationText } from "./safeText.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeNotificationChannel = (channel = "") => {
  const normalized = String(channel || "").trim().toUpperCase();
  return Object.values(NOTIFICATION_CHANNELS).includes(normalized) ? normalized : "";
};

export const isValidNotificationEmail = (value = "") =>
  EMAIL_PATTERN.test(String(value || "").trim());

export const normalizePhoneForNotification = (value = "") =>
  String(value || "").replace(/[^\d+]/g, "").trim();

export const isValidNotificationPhone = (value = "") => {
  const normalized = normalizePhoneForNotification(value);
  return /^\+?\d{8,15}$/.test(normalized);
};

export const isNotificationChannelAvailable = (channel, contact = {}) => {
  const normalized = normalizeNotificationChannel(channel);
  if (normalized === NOTIFICATION_CHANNELS.COPY) return true;
  if (normalized === NOTIFICATION_CHANNELS.IN_APP) return Boolean(contact.inApp);
  if (normalized === NOTIFICATION_CHANNELS.EMAIL) return isValidNotificationEmail(contact.email);
  if (normalized === NOTIFICATION_CHANNELS.WHATSAPP) {
    return isValidNotificationPhone(contact.whatsapp || contact.phone);
  }
  if (normalized === NOTIFICATION_CHANNELS.SMS) return isValidNotificationPhone(contact.sms || contact.phone);
  return false;
};

export const getAvailableNotificationChannels = (contact = {}) =>
  Object.values(NOTIFICATION_CHANNELS).filter((channel) =>
    isNotificationChannelAvailable(channel, contact)
  );

export const buildMailtoHref = ({ to = "", subject = "", body = "" } = {}) => {
  const recipient = isValidNotificationEmail(to) ? String(to).trim() : "";
  const query = new URLSearchParams();
  if (subject) query.set("subject", sanitizeNotificationText(subject, { maxLength: 140 }));
  if (body) query.set("body", sanitizeNotificationText(body, { maxLength: 2000 }));
  const queryText = query.toString();
  return `mailto:${recipient}${queryText ? `?${queryText}` : ""}`;
};

export const buildWhatsAppHref = ({ phone = "", text = "" } = {}) => {
  const normalizedPhone = normalizePhoneForNotification(phone).replace(/^\+/, "");
  const query = new URLSearchParams();
  if (text) query.set("text", sanitizeNotificationText(text, { maxLength: 1200 }));
  const queryText = query.toString();
  return `https://wa.me/${normalizedPhone}${queryText ? `?${queryText}` : ""}`;
};
