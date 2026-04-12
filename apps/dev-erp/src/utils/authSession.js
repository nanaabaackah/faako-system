export const AUTH_SESSION_INVALID_EVENT = "dev-kpi:auth-session-invalid";

const AUTH_TOKEN_STORAGE_KEY = "token";
const AUTH_USER_STORAGE_KEY = "user";

const dispatchSessionInvalidEvent = (detail = {}) => {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;

  try {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_INVALID_EVENT, { detail }));
  } catch {
    window.dispatchEvent(new Event(AUTH_SESSION_INVALID_EVENT));
  }
};

export const readStoredSessionUser = () => {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
};

export const hasStoredSession = () =>
  Boolean(readStoredSessionUser());

export const writeStoredSession = (user) => {
  if (typeof window === "undefined" || !user) return;
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearStoredSession = (options = {}) => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);

  if (options.notify) {
    dispatchSessionInvalidEvent({
      reason: options.reason || "invalid-session",
    });
  }
};

export const addSessionInvalidListener = (listener) => {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {};
  }

  const handler = (event) => {
    listener(event?.detail);
  };

  window.addEventListener(AUTH_SESSION_INVALID_EVENT, handler);
  return () => {
    window.removeEventListener(AUTH_SESSION_INVALID_EVENT, handler);
  };
};

export const normalizeLegacySessionToken = () => {
  if (typeof window === "undefined") return;

  const currentToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!currentToken) return;
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};
