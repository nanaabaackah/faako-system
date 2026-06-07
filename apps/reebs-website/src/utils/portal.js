const DEFAULT_PORTAL_BASE_URL = "https://portal.reebspartythemes.com";
const LOCAL_PORTAL_BASE_URL = "http://localhost:5174";

const normalizeBaseUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
};

export const getPortalBaseUrl = () => {
  const explicitPortalBase = normalizeBaseUrl(import.meta.env?.VITE_REEBS_PORTAL_URL);
  if (explicitPortalBase) return explicitPortalBase;

  if (import.meta.env?.DEV) {
    return LOCAL_PORTAL_BASE_URL;
  }

  return DEFAULT_PORTAL_BASE_URL;
};

export const buildPortalUrl = (path = "/login") => {
  const normalizedPath = String(path || "/login").startsWith("/")
    ? String(path || "/login")
    : `/${String(path || "login")}`;

  try {
    return new URL(normalizedPath, `${getPortalBaseUrl()}/`).toString();
  } catch {
    return `${DEFAULT_PORTAL_BASE_URL}${normalizedPath}`;
  }
};

export const isPortalAppOrigin = () => {
  if (typeof window === "undefined") return false;

  const portalBaseUrl = getPortalBaseUrl();
  if (!portalBaseUrl) return false;

  try {
    return window.location.origin === new URL(portalBaseUrl).origin;
  } catch {
    return false;
  }
};
