import React, { createContext, useContext, useEffect, useState } from "react";
import {
  addAuthInvalidListener,
  AUTH_USER_STORAGE_KEY,
  clearAuthState,
  getAuthToken,
  isAuthTokenExpired,
  setAuthToken,
} from "../../utils/organization.js";
import { isPortalAppOrigin } from "../../utils/portal.js";

const AuthContext = createContext(null);
const SESSION_VALIDATION_TIMEOUT_MS = 6500;

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const storageKey = AUTH_USER_STORAGE_KEY;

  const sanitizeUser = (value) => {
    if (!value || typeof value !== "object") return null;
    const { token: _ignoredToken, ...safeUser } = value;
    return safeUser;
  };

  const readStoredUser = () => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(storageKey) || window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    try {
      return sanitizeUser(JSON.parse(raw));
    } catch {
      return null;
    }
  };

  const writeStoredUser = (nextUser, remember) => {
    if (typeof window === "undefined") return;
    const safeUser = sanitizeUser(nextUser);
    if (!safeUser) return;
    try {
      if (remember) {
        window.localStorage.setItem(storageKey, JSON.stringify(safeUser));
        window.sessionStorage.removeItem(storageKey);
      } else {
        window.sessionStorage.setItem(storageKey, JSON.stringify(safeUser));
        window.localStorage.removeItem(storageKey);
      }
    } catch (err) {
      console.warn("Failed to persist user", err);
    }
  };

  const updateStoredUser = (nextUser) => {
    if (typeof window === "undefined") return;
    const safeUser = sanitizeUser(nextUser);
    if (!safeUser) return;
    try {
      if (window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, JSON.stringify(safeUser));
      } else if (window.sessionStorage.getItem(storageKey)) {
        window.sessionStorage.setItem(storageKey, JSON.stringify(safeUser));
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(safeUser));
      }
    } catch (err) {
      console.warn("Failed to persist user", err);
    }
  };

  const resetAuthState = (options = {}) => {
    clearAuthState(options);
    setUser(null);
    setAuthLoading(false);
    setAuthError("");
  };

  useEffect(() => {
    let isActive = true;

    const initializeAuth = async () => {
      if (!isPortalAppOrigin()) {
        resetAuthState();
        if (isActive) setAuthReady(true);
        return;
      }

      const storedUser = readStoredUser();
      const storedToken = getAuthToken();
      if (storedUser && isActive) {
        setUser(storedUser);
      }

      const hasLegacyToken = Boolean(storedToken) && !isAuthTokenExpired(storedToken);
      if (hasLegacyToken) {
        setAuthToken(storedToken);
      } else if (storedToken) {
        setAuthToken(null);
      }

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), SESSION_VALIDATION_TIMEOUT_MS)
        : 0;

      try {
        const response = await fetch("/api/authSession", {
          cache: "no-store",
          signal: controller?.signal,
        });

        if (!isActive) return;

        if (response.ok) {
          const nextUser = sanitizeUser(await response.json());
          setAuthToken(null);
          setUser(nextUser);
          updateStoredUser(nextUser);
        } else if (response.status === 401 || response.status === 403) {
          resetAuthState();
        } else {
          console.warn("Auth session validation returned an unexpected status", response.status);
        }
      } catch (error) {
        console.warn("Failed to validate auth session", error);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
        if (isActive) {
          setAuthReady(true);
        }
      }
    };

    initializeAuth();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => addAuthInvalidListener(() => {
    resetAuthState();
    setAuthReady(true);
  }), []);

  const login = async (email, password, remember = true) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      const safeUser = sanitizeUser(data);
      setAuthToken(null);
      setUser(safeUser);
      writeStoredUser(safeUser, remember);
      return safeUser;
    } catch (err) {
      setAuthError(err.message || "Login failed");
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    if (typeof window !== "undefined" && typeof window.fetch === "function") {
      window.fetch("/api/logout", {
        method: "POST",
        keepalive: true,
      }).catch((err) => {
        console.warn("Failed to close auth session", err);
      });
    }
    resetAuthState();
  };

  const updateUser = (nextUser) => {
    if (!nextUser) {
      setUser(nextUser);
      resetAuthState();
      return;
    }
    const baseUser = user && typeof user === "object" ? user : {};
    const mergedUser = sanitizeUser({ ...baseUser, ...nextUser });
    setUser(mergedUser);
    updateStoredUser(mergedUser);
  };

  const value = {
    user,
    login,
    logout,
    updateUser,
    authLoading,
    authError,
    authReady,
    isAuthenticated: Boolean(user),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
