export type StroaneAppSurface = "storefront" | "portal" | "combined";

const DEFAULT_STOREFRONT_BASE_URL = "https://stroanesolutions.com";
const DEFAULT_PORTAL_BASE_URL = 
  import.meta.env.VITE_ADMIN_PORTAL_URL ??
  "https://portal.stroanesolutions.com";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

const normalizeBaseUrl = (value: string | undefined, fallback: string) => {
  const candidate = String(value || fallback).trim().replace(/\/+$/, "");

  try {
    return new URL(candidate).origin;
  } catch {
    return fallback;
  }
};

const appendPath = (baseUrl: string, path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${baseUrl}/`).toString();
};

export const STOREFRONT_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_STOREFRONT_BASE_URL,
  DEFAULT_STOREFRONT_BASE_URL
);

export const PORTAL_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_PORTAL_BASE_URL,
  DEFAULT_PORTAL_BASE_URL
);

export const portalUrl = (path = "/") => appendPath(PORTAL_BASE_URL, path);
export const storefrontUrl = (path = "/") => appendPath(STOREFRONT_BASE_URL, path);
export const PORTAL_LOGIN_URL = portalUrl("/login");

export const resolveAppSurface = (): StroaneAppSurface => {
  const configuredSurface = String(import.meta.env.VITE_APP_SURFACE || "")
    .trim()
    .toLowerCase();

  if (configuredSurface === "storefront" || configuredSurface === "portal") {
    return configuredSurface;
  }

  if (typeof window === "undefined") return "storefront";

  const { hostname } = window.location;
  if (hostname === new URL(PORTAL_BASE_URL).hostname) return "portal";
  if (LOCAL_HOSTS.has(hostname)) return "combined";
  return "storefront";
};

