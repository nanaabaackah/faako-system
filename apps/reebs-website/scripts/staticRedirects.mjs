export const PORTAL_ORIGIN_MARKER = "__REEBS_PORTAL_ORIGIN__";
export const DEFAULT_PORTAL_ORIGIN = "https://portal.reebspartythemes.com";

export const resolvePortalOrigin = (value) => {
  const candidate = String(value || "").trim();
  if (!candidate) return DEFAULT_PORTAL_ORIGIN;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return DEFAULT_PORTAL_ORIGIN;
    }
    return parsed.origin;
  } catch {
    return DEFAULT_PORTAL_ORIGIN;
  }
};

export const finalizePortalRedirects = (template, portalUrl) => {
  const source = String(template || "");
  if (!source.includes(PORTAL_ORIGIN_MARKER)) {
    throw new Error(`Missing ${PORTAL_ORIGIN_MARKER} in storefront redirects.`);
  }

  return source.replaceAll(PORTAL_ORIGIN_MARKER, resolvePortalOrigin(portalUrl));
};
