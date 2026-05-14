import assert from "node:assert/strict";
import test from "node:test";
import {
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  DEFAULT_ORGANIZATION_SETTINGS,
  DEFAULT_TIMEZONE,
  ORG_SETTINGS_FIELDS,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES,
  TIMEZONE_VALUES,
  getOrganizationBranding,
  getOrganizationContactInfo,
  getOrganizationCurrency,
  getOrganizationCurrencySymbol,
  getOrganizationDisplayName,
  getOrganizationTimezone,
  isSafeOrgSettingsKey,
  normalizeOrganizationSettings,
  stripSensitiveOrgSettings,
} from "../src/index.js";

// ─── Constants ───────────────────────────────────────────────────────────────

test("DEFAULT_CURRENCY is GHS", () => {
  assert.equal(DEFAULT_CURRENCY, "GHS");
});

test("DEFAULT_TIMEZONE is Africa/Accra", () => {
  assert.equal(DEFAULT_TIMEZONE, "Africa/Accra");
});

test("SUPPORTED_CURRENCIES has at least 7 entries each with code, symbol, name", () => {
  assert.ok(SUPPORTED_CURRENCIES.length >= 7);
  for (const entry of SUPPORTED_CURRENCIES) {
    assert.equal(typeof entry.code, "string");
    assert.equal(typeof entry.symbol, "string");
    assert.equal(typeof entry.name, "string");
  }
});

test("CURRENCY_CODES includes GHS, USD, EUR, GBP, NGN", () => {
  assert.ok(CURRENCY_CODES.includes("GHS"));
  assert.ok(CURRENCY_CODES.includes("USD"));
  assert.ok(CURRENCY_CODES.includes("EUR"));
  assert.ok(CURRENCY_CODES.includes("GBP"));
  assert.ok(CURRENCY_CODES.includes("NGN"));
});

test("SUPPORTED_TIMEZONES has at least 5 entries each with value and label", () => {
  assert.ok(SUPPORTED_TIMEZONES.length >= 5);
  for (const entry of SUPPORTED_TIMEZONES) {
    assert.equal(typeof entry.value, "string");
    assert.equal(typeof entry.label, "string");
  }
});

test("TIMEZONE_VALUES includes Africa/Accra, Africa/Lagos, UTC", () => {
  assert.ok(TIMEZONE_VALUES.includes("Africa/Accra"));
  assert.ok(TIMEZONE_VALUES.includes("Africa/Lagos"));
  assert.ok(TIMEZONE_VALUES.includes("UTC"));
});

test("ORG_SETTINGS_FIELDS.BUSINESS_NAME is businessName", () => {
  assert.equal(ORG_SETTINGS_FIELDS.BUSINESS_NAME, "businessName");
});

test("ORG_SETTINGS_FIELDS.CURRENCY is currency", () => {
  assert.equal(ORG_SETTINGS_FIELDS.CURRENCY, "currency");
});

test("ORG_SETTINGS_FIELDS.TIMEZONE is timezone", () => {
  assert.equal(ORG_SETTINGS_FIELDS.TIMEZONE, "timezone");
});

test("ORG_SETTINGS_FIELDS is frozen", () => {
  assert.throws(() => {
    ORG_SETTINGS_FIELDS.CUSTOM = "custom";
  }, TypeError);
});

test("DEFAULT_ORGANIZATION_SETTINGS has expected default values", () => {
  assert.equal(DEFAULT_ORGANIZATION_SETTINGS.currency, DEFAULT_CURRENCY);
  assert.equal(DEFAULT_ORGANIZATION_SETTINGS.timezone, DEFAULT_TIMEZONE);
  assert.equal(DEFAULT_ORGANIZATION_SETTINGS.businessName, "");
  assert.equal(DEFAULT_ORGANIZATION_SETTINGS.enabledModules, null);
  assert.equal(DEFAULT_ORGANIZATION_SETTINGS.notificationPrefs, null);
});

// ─── normalizeOrganizationSettings ───────────────────────────────────────────

test("normalizeOrganizationSettings(null) returns default shape", () => {
  const result = normalizeOrganizationSettings(null);
  assert.equal(result.currency, DEFAULT_CURRENCY);
  assert.equal(result.timezone, DEFAULT_TIMEZONE);
  assert.equal(result.businessName, "");
  assert.equal(result.enabledModules, null);
});

test("normalizeOrganizationSettings(undefined) returns default shape", () => {
  const result = normalizeOrganizationSettings(undefined);
  assert.equal(result.currency, DEFAULT_CURRENCY);
  assert.equal(result.timezone, DEFAULT_TIMEZONE);
});

test("normalizeOrganizationSettings({}) returns defaults for all fields", () => {
  const result = normalizeOrganizationSettings({});
  assert.equal(result.businessName, "");
  assert.equal(result.currency, DEFAULT_CURRENCY);
  assert.equal(result.timezone, DEFAULT_TIMEZONE);
  assert.equal(result.enabledModules, null);
  assert.equal(result.notificationPrefs, null);
});

test("normalizeOrganizationSettings trims string fields", () => {
  const result = normalizeOrganizationSettings({
    businessName: "  Acme Corp  ",
    city: "  Accra  ",
    contactEmail: "  info@acme.com  ",
  });
  assert.equal(result.businessName, "Acme Corp");
  assert.equal(result.city, "Accra");
  assert.equal(result.contactEmail, "info@acme.com");
});

test("normalizeOrganizationSettings accepts a known currency", () => {
  const result = normalizeOrganizationSettings({ currency: "USD" });
  assert.equal(result.currency, "USD");
});

test("normalizeOrganizationSettings falls back to DEFAULT_CURRENCY for unknown currency", () => {
  const result = normalizeOrganizationSettings({ currency: "FAKE" });
  assert.equal(result.currency, DEFAULT_CURRENCY);
});

test("normalizeOrganizationSettings accepts a known timezone", () => {
  const result = normalizeOrganizationSettings({ timezone: "Africa/Lagos" });
  assert.equal(result.timezone, "Africa/Lagos");
});

test("normalizeOrganizationSettings falls back to DEFAULT_TIMEZONE for unknown timezone", () => {
  const result = normalizeOrganizationSettings({ timezone: "Not/Valid" });
  assert.equal(result.timezone, DEFAULT_TIMEZONE);
});

test("normalizeOrganizationSettings copies enabledModules array", () => {
  const input = { enabledModules: ["rent", "reports"] };
  const result = normalizeOrganizationSettings(input);
  assert.deepEqual(result.enabledModules, ["rent", "reports"]);
  assert.notEqual(result.enabledModules, input.enabledModules);
});

test("normalizeOrganizationSettings keeps enabledModules null when not an array", () => {
  assert.equal(normalizeOrganizationSettings({ enabledModules: null }).enabledModules, null);
  assert.equal(normalizeOrganizationSettings({ enabledModules: "rent" }).enabledModules, null);
});

test("normalizeOrganizationSettings shallow-copies notificationPrefs object", () => {
  const input = { notificationPrefs: { emailEnabled: true, smsEnabled: false } };
  const result = normalizeOrganizationSettings(input);
  assert.deepEqual(result.notificationPrefs, { emailEnabled: true, smsEnabled: false });
  assert.notEqual(result.notificationPrefs, input.notificationPrefs);
});

test("normalizeOrganizationSettings sets notificationPrefs null for non-object", () => {
  assert.equal(normalizeOrganizationSettings({ notificationPrefs: "yes" }).notificationPrefs, null);
  assert.equal(normalizeOrganizationSettings({ notificationPrefs: null }).notificationPrefs, null);
});

// ─── Display helpers ─────────────────────────────────────────────────────────

test("getOrganizationDisplayName returns trimmed businessName", () => {
  assert.equal(getOrganizationDisplayName({ businessName: "  Acme  " }), "Acme");
});

test("getOrganizationDisplayName returns empty string when businessName is missing", () => {
  assert.equal(getOrganizationDisplayName({}), "");
  assert.equal(getOrganizationDisplayName(null), "");
  assert.equal(getOrganizationDisplayName(undefined), "");
});

test("getOrganizationCurrency returns the specified currency", () => {
  assert.equal(getOrganizationCurrency({ currency: "NGN" }), "NGN");
});

test("getOrganizationCurrency falls back to DEFAULT_CURRENCY when missing", () => {
  assert.equal(getOrganizationCurrency({}), DEFAULT_CURRENCY);
  assert.equal(getOrganizationCurrency(null), DEFAULT_CURRENCY);
});

test("getOrganizationCurrencySymbol returns ₵ for GHS", () => {
  assert.equal(getOrganizationCurrencySymbol({ currency: "GHS" }), "₵");
});

test("getOrganizationCurrencySymbol returns $ for USD", () => {
  assert.equal(getOrganizationCurrencySymbol({ currency: "USD" }), "$");
});

test("getOrganizationCurrencySymbol falls back to DEFAULT_CURRENCY symbol for unknown code", () => {
  const defaultSymbol = SUPPORTED_CURRENCIES.find((c) => c.code === DEFAULT_CURRENCY)?.symbol;
  assert.equal(getOrganizationCurrencySymbol({}), defaultSymbol);
});

test("getOrganizationTimezone returns the specified timezone", () => {
  assert.equal(getOrganizationTimezone({ timezone: "Africa/Lagos" }), "Africa/Lagos");
});

test("getOrganizationTimezone falls back to DEFAULT_TIMEZONE when missing", () => {
  assert.equal(getOrganizationTimezone({}), DEFAULT_TIMEZONE);
  assert.equal(getOrganizationTimezone(null), DEFAULT_TIMEZONE);
});

test("getOrganizationBranding returns branding fields", () => {
  const result = getOrganizationBranding({
    logoUrl: "https://example.com/logo.png",
    primaryColor: "#1a1a2e",
    accentColor: "#e94560",
  });
  assert.equal(result.logoUrl, "https://example.com/logo.png");
  assert.equal(result.primaryColor, "#1a1a2e");
  assert.equal(result.accentColor, "#e94560");
  assert.equal(result.faviconUrl, "");
});

test("getOrganizationBranding returns empty strings for null input", () => {
  const result = getOrganizationBranding(null);
  assert.equal(result.logoUrl, "");
  assert.equal(result.primaryColor, "");
  assert.equal(result.faviconUrl, "");
  assert.equal(result.accentColor, "");
});

test("getOrganizationContactInfo returns contact fields", () => {
  const result = getOrganizationContactInfo({
    contactEmail: "info@co.com",
    city: "Accra",
    country: "Ghana",
    whatsappNumber: "+233241234567",
  });
  assert.equal(result.contactEmail, "info@co.com");
  assert.equal(result.city, "Accra");
  assert.equal(result.country, "Ghana");
  assert.equal(result.whatsappNumber, "+233241234567");
  assert.equal(result.addressLine1, "");
});

test("getOrganizationContactInfo returns empty strings for null input", () => {
  const result = getOrganizationContactInfo(null);
  assert.equal(result.contactEmail, "");
  assert.equal(result.city, "");
  assert.equal(result.whatsappNumber, "");
});

// ─── Safe metadata ────────────────────────────────────────────────────────────

test("isSafeOrgSettingsKey returns true for safe keys", () => {
  assert.equal(isSafeOrgSettingsKey("businessName"), true);
  assert.equal(isSafeOrgSettingsKey("currency"), true);
  assert.equal(isSafeOrgSettingsKey("timezone"), true);
  assert.equal(isSafeOrgSettingsKey("logoUrl"), true);
  assert.equal(isSafeOrgSettingsKey("contactEmail"), true);
});

test("isSafeOrgSettingsKey returns false for apiKey variants", () => {
  assert.equal(isSafeOrgSettingsKey("apiKey"), false);
  assert.equal(isSafeOrgSettingsKey("apikey"), false);
  assert.equal(isSafeOrgSettingsKey("paystackApiKey"), false);
});

test("isSafeOrgSettingsKey returns false for secret/token/password", () => {
  assert.equal(isSafeOrgSettingsKey("webhookSecret"), false);
  assert.equal(isSafeOrgSettingsKey("accessToken"), false);
  assert.equal(isSafeOrgSettingsKey("password"), false);
  assert.equal(isSafeOrgSettingsKey("privateKey"), false);
});

test("isSafeOrgSettingsKey returns false for payment provider credential keys", () => {
  assert.equal(isSafeOrgSettingsKey("stripeKey"), false);
  assert.equal(isSafeOrgSettingsKey("paystackKey"), false);
  assert.equal(isSafeOrgSettingsKey("hubtelKey"), false);
});

test("isSafeOrgSettingsKey returns false for non-string input", () => {
  assert.equal(isSafeOrgSettingsKey(null), false);
  assert.equal(isSafeOrgSettingsKey(undefined), false);
  assert.equal(isSafeOrgSettingsKey(42), false);
});

test("stripSensitiveOrgSettings removes blocked keys and keeps safe keys", () => {
  const input = {
    businessName: "Acme",
    currency: "GHS",
    apiKey: "sk_live_123",
    webhookSecret: "wh_secret_abc",
    paystackKey: "pk_live_xyz",
  };
  const result = stripSensitiveOrgSettings(input);
  assert.equal(result.businessName, "Acme");
  assert.equal(result.currency, "GHS");
  assert.equal("apiKey" in result, false);
  assert.equal("webhookSecret" in result, false);
  assert.equal("paystackKey" in result, false);
});

test("stripSensitiveOrgSettings returns empty object for null input", () => {
  assert.deepEqual(stripSensitiveOrgSettings(null), {});
  assert.deepEqual(stripSensitiveOrgSettings(undefined), {});
});

test("stripSensitiveOrgSettings returns empty object for empty input", () => {
  assert.deepEqual(stripSensitiveOrgSettings({}), {});
});
