const PROD_WEBSITE_URL = "https://reebspartythemes.com";
const LOCAL_WEBSITE_URL = "http://localhost:5173";

const normalizeBaseUrl = (value, fallback) => {
  const nextValue = String(value || "").trim();
  if (!nextValue) return fallback;
  return nextValue.replace(/\/+$/, "");
};

export const getWebsiteBaseUrl = () => {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env?.VITE_REEBS_WEBSITE_URL, "");
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (!import.meta.env?.PROD && typeof window !== "undefined") {
    const hostname = window.location.hostname?.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return LOCAL_WEBSITE_URL;
    }
  }

  return PROD_WEBSITE_URL;
};

export const buildWebsiteUrl = (path = "/") => {
  const normalizedPath = String(path || "/").trim() || "/";
  const resolvedPath = /^https?:\/\//i.test(normalizedPath)
    ? normalizedPath
    : normalizedPath.startsWith("/")
      ? normalizedPath
      : `/${normalizedPath}`;

  return new URL(resolvedPath, `${getWebsiteBaseUrl()}/`).toString();
};

export const WEBSITE_URL = PROD_WEBSITE_URL;
