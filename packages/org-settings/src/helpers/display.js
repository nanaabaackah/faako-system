import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "../constants/currencies.js";
import { DEFAULT_TIMEZONE } from "../constants/timezones.js";

export const getOrganizationDisplayName = (settings) => {
  const name = settings?.businessName;
  return typeof name === "string" && name.trim() ? name.trim() : "";
};

export const getOrganizationCurrency = (settings) => {
  const currency = settings?.currency;
  return typeof currency === "string" && currency.trim()
    ? currency.trim()
    : DEFAULT_CURRENCY;
};

export const getOrganizationCurrencySymbol = (settings) => {
  const code = getOrganizationCurrency(settings);
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  return found ? found.symbol : code;
};

export const getOrganizationTimezone = (settings) => {
  const tz = settings?.timezone;
  return typeof tz === "string" && tz.trim() ? tz.trim() : DEFAULT_TIMEZONE;
};

export const getOrganizationBranding = (settings) => ({
  logoUrl:      typeof settings?.logoUrl === "string" ? settings.logoUrl.trim() : "",
  faviconUrl:   typeof settings?.faviconUrl === "string" ? settings.faviconUrl.trim() : "",
  primaryColor: typeof settings?.primaryColor === "string" ? settings.primaryColor.trim() : "",
  accentColor:  typeof settings?.accentColor === "string" ? settings.accentColor.trim() : "",
});

export const getOrganizationContactInfo = (settings) => ({
  contactEmail:   typeof settings?.contactEmail === "string" ? settings.contactEmail.trim() : "",
  contactPhone:   typeof settings?.contactPhone === "string" ? settings.contactPhone.trim() : "",
  whatsappNumber: typeof settings?.whatsappNumber === "string" ? settings.whatsappNumber.trim() : "",
  addressLine1:   typeof settings?.addressLine1 === "string" ? settings.addressLine1.trim() : "",
  addressLine2:   typeof settings?.addressLine2 === "string" ? settings.addressLine2.trim() : "",
  city:           typeof settings?.city === "string" ? settings.city.trim() : "",
  country:        typeof settings?.country === "string" ? settings.country.trim() : "",
});
