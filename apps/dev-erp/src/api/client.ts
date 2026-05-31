import { buildApiUrl } from "../api-url";
import {
  clearStoredSession,
  hasStoredSession,
  readStoredCsrfToken,
  writeStoredCsrfToken,
} from "../utils/authSession";
import { getApiErrorMessage, readJsonResponse } from "../utils/http";

const AUTH_CSRF_COOKIE_NAME = import.meta.env.VITE_AUTH_CSRF_COOKIE_NAME || "dev_kpi_csrf";
const FETCH_PATCH_FLAG = "__devKpiApiFetchPatched__";
const AUTH_REFRESH_API_PATH = "/api/auth/refresh";
const AUTH_IGNORED_API_PATHS = new Set([
  "/api/auth/login",
  AUTH_REFRESH_API_PATH,
  "/api/auth/forgot-password",
  "/api/auth/setup-account/verify",
  "/api/auth/setup-account/complete",
]);

type Validator<T> = (payload: unknown) => payload is T;
type ApiFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ApiRequestOptions<T> = RequestInit & {
  fallbackMessage?: string;
  validate?: Validator<T>;
};

export class ApiError extends Error {
  status: number;
  payload: unknown;
  url: string;

  constructor(message: string, { status, payload, url }: { status: number; payload: unknown; url: string }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.url = url;
  }
}

const readCookie = (name: string): string => {
  if (!name || typeof document === "undefined") return "";
  const entries = document.cookie ? document.cookie.split(";") : [];
  for (const entry of entries) {
    const [rawKey, ...rawValueParts] = entry.split("=");
    let key = rawKey.trim();
    try {
      key = decodeURIComponent(rawKey.trim());
    } catch {
      key = rawKey.trim();
    }
    if (key !== name) continue;
    const rawValue = rawValueParts.join("=").trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return "";
};

const captureCsrfToken = (payload: unknown) => {
  const token =
    payload && typeof payload === "object" && "csrfToken" in payload
      ? (payload as { csrfToken?: unknown }).csrfToken
      : "";
  if (typeof token === "string" && token.trim()) {
    writeStoredCsrfToken(token);
  }
};

const isCsrfMethod = (method: unknown): boolean => {
  const normalized = String(method || "GET").toUpperCase();
  return !["GET", "HEAD", "OPTIONS"].includes(normalized);
};

const isApiRequest = (input: RequestInfo | URL): boolean => {
  if (typeof window === "undefined") return false;
  const rawUrl =
    typeof input === "string" || input instanceof URL
      ? String(input)
      : input instanceof Request
        ? input.url
        : "";
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    return parsed.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

const resolveApiPathname = (input: RequestInfo | URL): string => {
  if (typeof window === "undefined") return "";

  const rawUrl =
    typeof input === "string" || input instanceof URL
      ? String(input)
      : input instanceof Request
        ? input.url
        : "";

  if (!rawUrl) return "";

  try {
    return new URL(rawUrl, window.location.origin).pathname;
  } catch {
    return "";
  }
};

const isSessionManagedApiRequest = (input: RequestInfo | URL): boolean => {
  const pathname = resolveApiPathname(input);
  if (!pathname.startsWith("/api/")) return false;
  return !AUTH_IGNORED_API_PATHS.has(pathname);
};

const withApiDefaults = (input: RequestInfo | URL, init: RequestInit = {}): RequestInit => {
  const method = init.method || (input instanceof Request ? input.method : "GET");
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));

  if (isCsrfMethod(method) && !headers.has("x-csrf-token")) {
    const csrfToken = readCookie(AUTH_CSRF_COOKIE_NAME) || readStoredCsrfToken();
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  return {
    ...init,
    headers,
    credentials: init.credentials || (input instanceof Request ? input.credentials : undefined) || "include",
  };
};

const handleUnauthorized = (input: RequestInfo | URL, status: number) => {
  if (status === 401 && hasStoredSession() && isSessionManagedApiRequest(input)) {
    clearStoredSession({
      notify: true,
      reason: "expired-session",
    });
  }
};

const canReplayRequest = (input: RequestInfo | URL): boolean => {
  if (typeof Request === "undefined" || !(input instanceof Request)) return true;
  return !input.bodyUsed;
};

let refreshSessionPromise: Promise<boolean> | null = null;

const requestSessionRefresh = (fetcher: ApiFetcher): Promise<boolean> => {
  if (!refreshSessionPromise) {
    const refreshUrl = buildApiUrl(AUTH_REFRESH_API_PATH);
    refreshSessionPromise = fetcher(
      refreshUrl,
      withApiDefaults(refreshUrl, { method: "POST" })
    )
      .then(async (response) => {
        if (response.ok) {
          captureCsrfToken(await response.clone().json().catch(() => null));
        }
        return response.ok;
      })
      .catch(() => false)
      .finally(() => {
        refreshSessionPromise = null;
      });
  }

  return refreshSessionPromise;
};

export const installApiFetchInterceptor = () => {
  const patchedWindow =
    typeof window === "undefined"
      ? null
      : (window as unknown as Window & Record<string, boolean>);
  if (!patchedWindow || patchedWindow[FETCH_PATCH_FLAG]) return;
  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
    if (!isApiRequest(input)) {
      return nativeFetch(input, init);
    }

    const nextInit = withApiDefaults(input, init);
    return nativeFetch(input, nextInit).then(async (response) => {
      if (
        response.status === 401 &&
        hasStoredSession() &&
        isSessionManagedApiRequest(input) &&
        canReplayRequest(input)
      ) {
        const refreshed = await requestSessionRefresh(nativeFetch);
        if (refreshed) {
          return nativeFetch(input, withApiDefaults(input, init));
        }
      }

      handleUnauthorized(input, response.status);
      return response;
    });
  };

  patchedWindow[FETCH_PATCH_FLAG] = true;
};

export const apiRequest = async <T = unknown>(
  path: string,
  options: ApiRequestOptions<T> = {}
): Promise<T> => {
  const { fallbackMessage = "Request failed.", validate, ...fetchOptions } = options;
  const url = buildApiUrl(path);
  const response = await fetch(url, withApiDefaults(url, fetchOptions));
  const payload = await readJsonResponse<T>(response);
  captureCsrfToken(payload);

  if (!response.ok) {
    handleUnauthorized(url, response.status);
    throw new ApiError(getApiErrorMessage(payload, fallbackMessage), {
      status: response.status,
      payload,
      url,
    });
  }

  if (validate && !validate(payload)) {
    throw new ApiError("API response did not match the expected shape.", {
      status: response.status,
      payload,
      url,
    });
  }

  return payload as T;
};

export const apiGet = <T = unknown>(path: string, options: ApiRequestOptions<T> = {}) =>
  apiRequest<T>(path, { ...options, method: "GET" });

export const apiPost = <T = unknown>(
  path: string,
  body?: unknown,
  options: ApiRequestOptions<T> = {}
) => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  return apiRequest<T>(path, {
    ...options,
    method: "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

export const apiPatch = <T = unknown>(
  path: string,
  body?: unknown,
  options: ApiRequestOptions<T> = {}
) => {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  return apiRequest<T>(path, {
    ...options,
    method: "PATCH",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

export const apiDelete = <T = unknown>(path: string, options: ApiRequestOptions<T> = {}) =>
  apiRequest<T>(path, { ...options, method: "DELETE" });
