import { REEBS_API_V1_ROUTES } from "@faako/api-contracts";

export const PORTAL_SETTINGS_ENDPOINT = REEBS_API_V1_ROUTES.PORTAL_SETTINGS;

export const DEFAULT_DOCUMENT_IDENTITY = Object.freeze({
  storeName: "REEBS Party Themes",
  storeEmail: "info@reebspartythemes.com",
  storePhone: "+233 24 478 1819",
  storeAddress: "Sakumono Broadway, Tema, Ghana",
});

const DOCUMENT_IDENTITY_FIELDS = Object.freeze([
  "storeName",
  "storeEmail",
  "storePhone",
  "storeAddress",
]);

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

export const sanitizeDocumentIdentity = (value = {}) =>
  DOCUMENT_IDENTITY_FIELDS.reduce(
    (identity, field) => ({
      ...identity,
      [field]: cleanString(value?.[field]) || DEFAULT_DOCUMENT_IDENTITY[field],
    }),
    {},
  );

export const readCachedPortalConfig = () => {
  if (typeof window === "undefined") return { ...DEFAULT_DOCUMENT_IDENTITY };
  try {
    const stored = window.localStorage.getItem("reebs_erp_config");
    const parsed = stored ? JSON.parse(stored) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const cacheDocumentIdentity = (identity) => {
  const normalized = sanitizeDocumentIdentity(identity);
  if (typeof window === "undefined") return normalized;

  const nextConfig = { ...readCachedPortalConfig(), ...normalized };
  try {
    window.localStorage.setItem("reebs_erp_config", JSON.stringify(nextConfig));
  } catch {
    // The backend remains authoritative when browser storage is unavailable.
  }
  return normalized;
};

const readPayload = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "Portal settings are unavailable.");
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data;
};

export const loadPortalSettings = async ({ signal } = {}) => {
  const response = await fetch(PORTAL_SETTINGS_ENDPOINT, { signal });
  return readPayload(response);
};

export const savePortalSettingsSection = async (section, value) => {
  const response = await fetch(PORTAL_SETTINGS_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section, value }),
  });
  return readPayload(response);
};
