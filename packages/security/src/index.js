export const SECURITY_PROFILE_IDS = [
  "public-static",
  "public-interactive",
  "authenticated-workspace",
  "api-service",
];

export const AUTH_MODES = ["none", "cookie", "bearer"];

export const BASE_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
};

export const SECURITY_PROFILE_MATRIX = {
  "public-static": {
    requiresHeaders: true,
    requiresOriginAllowlist: false,
    allowsBrowserAuthStorage: false,
  },
  "public-interactive": {
    requiresHeaders: true,
    requiresOriginAllowlist: false,
    allowsBrowserAuthStorage: false,
  },
  "authenticated-workspace": {
    requiresHeaders: true,
    requiresOriginAllowlist: true,
    allowsBrowserAuthStorage: true,
  },
  "api-service": {
    requiresHeaders: true,
    requiresOriginAllowlist: true,
    allowsBrowserAuthStorage: false,
  },
};

export const normalizeOrigin = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

export const mergeAllowedOrigins = (...groups) =>
  Array.from(
    new Set(
      groups
        .flat()
        .map((origin) => normalizeOrigin(origin))
        .filter(Boolean),
    ),
  );

export const isAllowedOrigin = (origin, allowedOrigins = []) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;
  return mergeAllowedOrigins(allowedOrigins).includes(normalizedOrigin);
};

export const normalizeAuthMode = (value, fallback = "none") => {
  const normalized = String(value || "").trim().toLowerCase();
  return AUTH_MODES.includes(normalized) ? normalized : fallback;
};

export const normalizeSecurityProfileId = (value, fallback = "public-static") => {
  const normalized = String(value || "").trim().toLowerCase();
  return SECURITY_PROFILE_IDS.includes(normalized) ? normalized : fallback;
};

const buildProfileContentSecurityPolicy = (profileId) => {
  if (profileId === "api-service") {
    return "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";
  }

  return "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http://localhost:* ws: wss:; script-src 'self'";
};

export const buildSecurityHeaders = ({
  profileId = "public-static",
  requestProtocol = "",
  extraHeaders = {},
} = {}) => {
  const normalizedProfileId = normalizeSecurityProfileId(profileId);
  const headers = {
    ...BASE_SECURITY_HEADERS,
    "Content-Security-Policy": buildProfileContentSecurityPolicy(normalizedProfileId),
    ...extraHeaders,
  };

  if (normalizedProfileId === "api-service") {
    headers["Cross-Origin-Opener-Policy"] = "same-origin";
    headers["Origin-Agent-Cluster"] = "?1";
  }

  if (String(requestProtocol || "").toLowerCase() === "https") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
};

export const buildCorsHeaders = ({
  origin,
  allowedOrigins = [],
  methods = "GET,POST,OPTIONS",
  allowHeaders = "Content-Type, Authorization, X-CSRF-Token, X-Organization-Id",
  allowCredentials = true,
} = {}) => {
  const headers = {
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": methods,
  };

  if (isAllowedOrigin(origin, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = normalizeOrigin(origin);
    headers.Vary = "Origin";
    if (allowCredentials) {
      headers["Access-Control-Allow-Credentials"] = "true";
    }
  }

  return headers;
};

export const buildApiSecurityHeaders = ({
  profileId = "api-service",
  origin,
  allowedOrigins = [],
  methods = "GET,POST,OPTIONS",
  allowHeaders = "Content-Type, Authorization, X-CSRF-Token, X-Organization-Id",
  allowCredentials = true,
  cacheControl = "no-store, private",
  requestProtocol = "",
  extraHeaders = {},
} = {}) => ({
  ...buildSecurityHeaders({ profileId, requestProtocol, extraHeaders }),
  ...buildCorsHeaders({ origin, allowedOrigins, methods, allowHeaders, allowCredentials }),
  ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
});

export const createExpressSecurityHeadersMiddleware =
  ({ profileId = "api-service", allowedOrigins = [], extraHeaders = {} } = {}) =>
  (req, res, next) => {
    const origin = req?.headers?.origin;
    const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "").toLowerCase();
    const requestProtocol = req?.secure || forwardedProto === "https" ? "https" : "";
    const headers = buildApiSecurityHeaders({
      profileId,
      origin,
      allowedOrigins,
      requestProtocol,
      extraHeaders,
    });

    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    next();
  };

export const validateAppSystemConfig = (config = {}) => {
  const errors = [];
  if (!config || typeof config !== "object") {
    return {
      valid: false,
      errors: ["App system config must export an object."],
    };
  }

  if (!String(config.appId || "").trim()) {
    errors.push("appId is required.");
  }

  if (!String(config?.brand?.name || "").trim()) {
    errors.push("brand.name is required.");
  }

  if (!String(config?.theme?.presetId || "").trim()) {
    errors.push("theme.presetId is required.");
  }

  const profileId = normalizeSecurityProfileId(config?.security?.profileId, "");
  if (!profileId) {
    errors.push("security.profileId is required.");
  }

  const authMode = normalizeAuthMode(config?.security?.authMode, "");
  if (!authMode) {
    errors.push("security.authMode is required.");
  }

  if (profileId === "authenticated-workspace" && authMode === "none") {
    errors.push("authenticated-workspace apps must declare security.authMode as cookie or bearer.");
  }

  if (SECURITY_PROFILE_MATRIX[profileId]?.requiresOriginAllowlist) {
    const allowedOrigins = Array.isArray(config?.security?.allowedOrigins)
      ? config.security.allowedOrigins.filter(Boolean)
      : [];
    if (!allowedOrigins.length) {
      errors.push("security.allowedOrigins is required for this security profile.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const isSensitivePublicEnvKey = (key) => {
  const normalized = String(key || "").trim().toUpperCase();
  if (!normalized.startsWith("VITE_")) return false;
  if (/(COOKIE_NAME|CSRF_COOKIE_NAME|CSRF_HEADER_NAME)/.test(normalized)) {
    return false;
  }
  if (/(PUBLIC|PUBLISHABLE|ANON|SITE_URL|APP_URL|BASE_URL|PORTAL_URL)/.test(normalized)) {
    return false;
  }
  return /(SECRET|PASSWORD|PRIVATE|SESSION|COOKIE|CSRF|JWT|TOKEN|ENCRYPTION|SIGNING)/.test(normalized);
};
