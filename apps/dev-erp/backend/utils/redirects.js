const SAFE_RELATIVE_REDIRECT_BASE = "https://app.local";
const MAX_SAFE_REDIRECT_PATH_LENGTH = 2048;

export const normalizeSafeRelativeRedirectPath = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_SAFE_REDIRECT_PATH_LENGTH) return fallback;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, SAFE_RELATIVE_REDIRECT_BASE);
    if (parsed.origin !== SAFE_RELATIVE_REDIRECT_BASE) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};

export const buildSafeAppRedirectUrl = ({ appBaseUrl, returnTo, searchParams = {} }) => {
  const safeReturnTo = normalizeSafeRelativeRedirectPath(returnTo);
  if (!safeReturnTo || !appBaseUrl) return null;

  try {
    const redirectUrl = new URL(safeReturnTo, appBaseUrl);
    const appOrigin = new URL(appBaseUrl).origin;
    if (redirectUrl.origin !== appOrigin) return null;

    Object.entries(searchParams).forEach(([key, value]) => {
      redirectUrl.searchParams.set(key, String(value));
    });

    return redirectUrl.toString();
  } catch {
    return null;
  }
};
