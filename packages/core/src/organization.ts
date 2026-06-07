type PatchedWindow = Window & typeof globalThis & {
  __orgFetchPatched?: boolean;
  __reebsAuthToken?: string;
};

const parseOrganizationId = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const AUTH_USER_STORAGE_KEY = "reebs_auth_user";
export const AUTH_TOKEN_STORAGE_KEY = "reebs_auth_token";
export const AUTH_INVALID_EVENT = "reebs:auth-invalid";

const LEGACY_FUNCTION_PREFIX = "/.netlify/functions/";
const API_PREFIX = "/api/";
const DEFAULT_BACKEND_BASE_URL = "https://api.reebspartythemes.com";
const DEFAULT_LOCAL_BACKEND_BASE_URL = "http://localhost:8888";
const USE_FUNCTION_PROXY_IN_DEV = ["1", "true", "yes", "on"].includes(
  String(import.meta.env?.VITE_FUNCTIONS_VIA_PROXY || "").trim().toLowerCase(),
);

const getLocalDevBackendBaseUrl = () => {
  if (typeof window === "undefined") return "";

  const hostname = window.location.hostname?.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return DEFAULT_LOCAL_BACKEND_BASE_URL;
  }

  return "";
};

const normalizeBackendBaseUrl = (value: unknown) => {
  const trimmed = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (!trimmed) return "";
  return trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;
};

const getBackendBaseUrl = () => {
  const envBase = normalizeBackendBaseUrl(
    import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_BACKEND_BASE_URL,
  );
  if (envBase) return envBase;

  if (import.meta.env?.DEV && typeof window !== "undefined") {
    return getLocalDevBackendBaseUrl() || window.location.origin;
  }

  return DEFAULT_BACKEND_BASE_URL;
};

const BACKEND_BASE_URL = getBackendBaseUrl();
const BACKEND_ORIGIN = (() => {
  try {
    return new URL(BACKEND_BASE_URL).origin;
  } catch {
    return null;
  }
})();

const getPatchedWindow = () =>
  (typeof window === "undefined" ? null : (window as PatchedWindow));

const dispatchAuthInvalidEvent = (detail: Record<string, unknown> = {}) => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;

  try {
    window.dispatchEvent(new CustomEvent(AUTH_INVALID_EVENT, { detail }));
  } catch {
    window.dispatchEvent(new Event(AUTH_INVALID_EVENT));
  }
};

const readStorageValue = (storage: Storage | undefined, key: string) => {
  if (!storage || typeof storage.getItem !== "function") return "";
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
};

const removeStorageValue = (storage: Storage | undefined, key: string) => {
  if (!storage || typeof storage.removeItem !== "function") return;
  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage write failures and keep the in-memory token available.
  }
};

const getStoredUser = () => {
  if (typeof window === "undefined") return null;

  const raw =
    readStorageValue(window.localStorage, AUTH_USER_STORAGE_KEY)
    || readStorageValue(window.sessionStorage, AUTH_USER_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const decodeBase64Url = (value: string) => {
  if (typeof window === "undefined" || typeof window.atob !== "function") return null;

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));

  try {
    return window.atob(`${normalized}${padding}`);
  } catch {
    return null;
  }
};

export const readAuthTokenPayload = (token: string | null | undefined = getAuthToken()) => {
  const trimmedToken = typeof token === "string" ? token.trim() : "";
  if (!trimmedToken) return null;

  const [payloadPart = ""] = trimmedToken.split(".");
  if (!payloadPart) return null;

  const decoded = decodeBase64Url(payloadPart);
  if (!decoded) return null;

  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export const isAuthTokenExpired = (token: string | null | undefined = getAuthToken()) => {
  const trimmedToken = typeof token === "string" ? token.trim() : "";
  if (!trimmedToken) return false;

  const payload = readAuthTokenPayload(trimmedToken);
  const exp = Number(payload?.exp);
  if (!payload || !Number.isFinite(exp)) return true;
  return Date.now() >= exp;
};

export const clearAuthState = (
  options: {
    notify?: boolean;
    reason?: string;
  } = {},
) => {
  const patchedWindow = getPatchedWindow();
  if (!patchedWindow) return;

  patchedWindow.__reebsAuthToken = "";
  removeStorageValue(window.localStorage, AUTH_TOKEN_STORAGE_KEY);
  removeStorageValue(window.sessionStorage, AUTH_TOKEN_STORAGE_KEY);
  removeStorageValue(window.localStorage, AUTH_USER_STORAGE_KEY);
  removeStorageValue(window.sessionStorage, AUTH_USER_STORAGE_KEY);

  if (options.notify) {
    dispatchAuthInvalidEvent({
      reason: options.reason || "invalid-session",
    });
  }
};

export const addAuthInvalidListener = (
  listener: (detail?: Record<string, unknown>) => void,
) => {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<Record<string, unknown>>;
    listener(customEvent.detail);
  };

  window.addEventListener(AUTH_INVALID_EVENT, handler);
  return () => {
    window.removeEventListener(AUTH_INVALID_EVENT, handler);
  };
};

export const setAuthToken = (
  token: string | null | undefined,
  _options: { remember?: boolean } = {},
) => {
  const patchedWindow = getPatchedWindow();
  if (!patchedWindow) return;

  const nextToken = typeof token === "string" ? token.trim() : "";

  patchedWindow.__reebsAuthToken = nextToken;
  removeStorageValue(window.localStorage, AUTH_TOKEN_STORAGE_KEY);
  removeStorageValue(window.sessionStorage, AUTH_TOKEN_STORAGE_KEY);
};

export const getAuthToken = () => {
  const patchedWindow = getPatchedWindow();
  if (!patchedWindow) return null;

  const memoryToken =
    typeof patchedWindow.__reebsAuthToken === "string"
      ? patchedWindow.__reebsAuthToken.trim()
      : "";
  if (memoryToken) return memoryToken;

  const storedToken =
    readStorageValue(window.localStorage, AUTH_TOKEN_STORAGE_KEY)
    || readStorageValue(window.sessionStorage, AUTH_TOKEN_STORAGE_KEY);
  if (storedToken.trim()) {
    return storedToken.trim();
  }

  const legacyUser = getStoredUser();
  const legacyToken = typeof legacyUser?.token === "string" ? legacyUser.token.trim() : "";
  if (!legacyToken) return null;

  setAuthToken(legacyToken, {
    remember: Boolean(readStorageValue(window.localStorage, AUTH_USER_STORAGE_KEY)),
  });
  return legacyToken;
};

export const getOrganizationId = () => {
  if (typeof window === "undefined") return null;

  const stored = getStoredUser();
  const fromUser = parseOrganizationId(stored?.organizationId);
  if (fromUser) return fromUser;

  const params = new URLSearchParams(window.location.search || "");
  return parseOrganizationId(params.get("organizationId"));
};

const isReebsApiPath = (pathname: string) =>
  pathname.startsWith(LEGACY_FUNCTION_PREFIX) || pathname.startsWith(API_PREFIX);

const isReebsApiRequest = (url: string) => {
  if (typeof window === "undefined") return false;

  try {
    const parsed = new URL(url, window.location.origin);
    return isReebsApiPath(parsed.pathname);
  } catch {
    return false;
  }
};

const getApiPathFromParsedUrl = (parsed: URL) => {
  if (parsed.pathname.startsWith(LEGACY_FUNCTION_PREFIX)) {
    return `${API_PREFIX}${parsed.pathname.slice(LEGACY_FUNCTION_PREFIX.length)}`;
  }

  return parsed.pathname;
};

const resolveBackendUrl = (url: string) => {
  if (typeof window === "undefined") return url;

  try {
    const parsed = new URL(url, window.location.origin);
    if (!isReebsApiPath(parsed.pathname)) return url;

    const apiPath = getApiPathFromParsedUrl(parsed);
    const normalizedPath = `${apiPath}${parsed.search}${parsed.hash}`;
    if (import.meta.env?.DEV && USE_FUNCTION_PROXY_IN_DEV) {
      return normalizedPath;
    }

    return BACKEND_BASE_URL
      ? new URL(normalizedPath, `${BACKEND_BASE_URL}/`).toString()
      : normalizedPath;
  } catch {
    return url;
  }
};

const shouldAttachOrganizationId = (url: string) => {
  if (typeof window === "undefined") return false;

  try {
    const parsed = new URL(url, window.location.origin);
    if (!isReebsApiPath(parsed.pathname)) return false;
    if (parsed.origin === window.location.origin) return true;
    return BACKEND_ORIGIN ? parsed.origin === BACKEND_ORIGIN : false;
  } catch {
    return false;
  }
};

const appendOrganizationId = (url: string, organizationId: number) => {
  const parsed = new URL(url, window.location.origin);
  if (parsed.searchParams.has("organizationId")) return parsed.toString();
  parsed.searchParams.set("organizationId", String(organizationId));
  return parsed.toString();
};

export const patchOrganizationFetch = () => {
  const patchedWindow = getPatchedWindow();
  if (!patchedWindow) return;
  if (patchedWindow.__orgFetchPatched) return;
  if (typeof patchedWindow.fetch !== "function") return;

  const originalFetch = patchedWindow.fetch.bind(patchedWindow);

  patchedWindow.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url;

    if (!url || !isReebsApiRequest(url)) {
      return originalFetch(input, init);
    }

    const resolvedUrl = resolveBackendUrl(url);
    const shouldAttach = shouldAttachOrganizationId(resolvedUrl);
    const organizationId = shouldAttach ? getOrganizationId() : null;
    const token = shouldAttach ? getAuthToken() : null;
    const nextUrl = organizationId
      ? appendOrganizationId(resolvedUrl, organizationId)
      : resolvedUrl;
    const baseHeaders = input instanceof Request ? input.headers : init?.headers;
    const headers = new Headers(baseHeaders || {});
    const isAuthenticatedRequest = headers.has("Authorization") || Boolean(token);

    if (organizationId && !headers.has("x-organization-id")) {
      headers.set("x-organization-id", String(organizationId));
    }

    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (input instanceof Request) {
      const request = new Request(input, init);
      const requestWithUrl = new Request(nextUrl, request);
      const requestedCredentials = init?.credentials || request.credentials;
      const nextRequest = new Request(requestWithUrl, {
        cache: request.cache === "default" ? "no-store" : request.cache,
        credentials: requestedCredentials && requestedCredentials !== "same-origin"
          ? requestedCredentials
          : "include",
        headers,
      });

      return originalFetch(nextRequest).then((response) => {
        if (isAuthenticatedRequest && response.status === 401) {
          clearAuthState({ notify: true, reason: "expired-session" });
        }
        return response;
      });
    }

    const nextInit = { ...(init || {}), headers };
    if (!Object.prototype.hasOwnProperty.call(nextInit, "cache")) {
      nextInit.cache = "no-store";
    }
    if (!Object.prototype.hasOwnProperty.call(nextInit, "credentials")) {
      nextInit.credentials = "include";
    }

    return originalFetch(nextUrl, nextInit).then((response) => {
      if (isAuthenticatedRequest && response.status === 401) {
        clearAuthState({ notify: true, reason: "expired-session" });
      }
      return response;
    });
  };

  patchedWindow.__orgFetchPatched = true;
};
