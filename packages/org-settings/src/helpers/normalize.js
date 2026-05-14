import { DEFAULT_CURRENCY, CURRENCY_CODES } from "../constants/currencies.js";
import { DEFAULT_TIMEZONE, TIMEZONE_VALUES } from "../constants/timezones.js";

export const DEFAULT_ORGANIZATION_SETTINGS = Object.freeze({
  businessName:      "",
  logoUrl:           "",
  faviconUrl:        "",
  primaryColor:      "",
  accentColor:       "",
  contactEmail:      "",
  contactPhone:      "",
  whatsappNumber:    "",
  addressLine1:      "",
  addressLine2:      "",
  city:              "",
  country:           "",
  currency:          DEFAULT_CURRENCY,
  timezone:          DEFAULT_TIMEZONE,
  enabledModules:    null,
  notificationPrefs: null,
});

const safeString = (value) =>
  typeof value === "string" ? value.trim() : "";

const safeCurrency = (value) =>
  typeof value === "string" && CURRENCY_CODES.includes(value.trim().toUpperCase())
    ? value.trim().toUpperCase()
    : DEFAULT_CURRENCY;

const safeTimezone = (value) =>
  typeof value === "string" && TIMEZONE_VALUES.includes(value.trim())
    ? value.trim()
    : DEFAULT_TIMEZONE;

export const normalizeOrganizationSettings = (raw) => {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ORGANIZATION_SETTINGS };
  }
  return {
    businessName:      safeString(raw.businessName),
    logoUrl:           safeString(raw.logoUrl),
    faviconUrl:        safeString(raw.faviconUrl),
    primaryColor:      safeString(raw.primaryColor),
    accentColor:       safeString(raw.accentColor),
    contactEmail:      safeString(raw.contactEmail),
    contactPhone:      safeString(raw.contactPhone),
    whatsappNumber:    safeString(raw.whatsappNumber),
    addressLine1:      safeString(raw.addressLine1),
    addressLine2:      safeString(raw.addressLine2),
    city:              safeString(raw.city),
    country:           safeString(raw.country),
    currency:          safeCurrency(raw.currency),
    timezone:          safeTimezone(raw.timezone),
    enabledModules:    Array.isArray(raw.enabledModules)
      ? [...raw.enabledModules]
      : null,
    notificationPrefs: raw.notificationPrefs && typeof raw.notificationPrefs === "object"
      ? { ...raw.notificationPrefs }
      : null,
  };
};
