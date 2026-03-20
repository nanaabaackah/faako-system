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

const DEFAULT_BACKEND_BASE_URL = "https://portal.reebspartythemes.com";
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

const getBackendBaseUrl = () => {
  const envBase = import.meta.env?.VITE_BACKEND_BASE_URL;
  const trimmed = typeof envBase === "string" ? envBase.trim() : "";
  if (trimmed) return trimmed.replace(/\/+$/, "");

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
  options: { remember?: boolean } = {},
) => {
  const patchedWindow = getPatchedWindow();
  if (!patchedWindow) return;

  const remember = options?.remember;
  const nextToken = typeof token === "string" ? token.trim() : "";

  patchedWindow.__reebsAuthToken = nextToken;

  if (remember === true || remember === false) {
    removeStorageValue(window.localStorage, AUTH_TOKEN_STORAGE_KEY);
    removeStorageValue(window.sessionStorage, AUTH_TOKEN_STORAGE_KEY);

    if (nextToken) {
      const target = remember ? window.localStorage : window.sessionStorage;
      try {
        target.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
      } catch {
        // Keep the in-memory token when storage writes fail.
      }
    }
    return;
  }

  if (!nextToken) {
    removeStorageValue(window.localStorage, AUTH_TOKEN_STORAGE_KEY);
    removeStorageValue(window.sessionStorage, AUTH_TOKEN_STORAGE_KEY);
  }
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

const isNetlifyFunctionRequest = (url: string) => {
  if (typeof window === "undefined") return false;

  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.pathname.startsWith("/.netlify/functions/");
  } catch {
    return false;
  }
};

const resolveBackendUrl = (url: string) => {
  if (!url.startsWith("/.netlify/functions/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (import.meta.env?.DEV && USE_FUNCTION_PROXY_IN_DEV) return url;
  if (!BACKEND_BASE_URL) return url;

  try {
    return new URL(url, BACKEND_BASE_URL).toString();
  } catch {
    return url;
  }
};

const shouldAttachOrganizationId = (url: string) => {
  if (typeof window === "undefined") return false;

  try {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.pathname.startsWith("/.netlify/functions/")) return false;
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

    if (!url || !isNetlifyFunctionRequest(url)) {
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
      const nextRequest = new Request(requestWithUrl, {
        cache: request.cache === "default" ? "no-store" : request.cache,
        credentials: request.credentials || "same-origin",
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
      nextInit.credentials = "same-origin";
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
