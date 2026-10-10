import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  addAuthInvalidListener,
  AUTH_USER_STORAGE_KEY,
  clearAuthState,
} from "@faako/core";
import { sanitizeAuthUser } from "./sanitizeAuthUser.js";

const AuthContext = createContext(null);
const SESSION_VALIDATION_TIMEOUT_MS = 6500;
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children, apiResponse }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authReady, setAuthReady] = useState(false);

  const readStoredUser = useCallback(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY)
      || window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      return sanitizeAuthUser(JSON.parse(raw));
    } catch {
      return null;
    }
  }, []);

  const writeStoredUser = useCallback((nextUser, remember) => {
    if (typeof window === "undefined") return;
    const safeUser = sanitizeAuthUser(nextUser);
    if (!safeUser) return;
    try {
      if (remember) {
        window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(safeUser));
        window.sessionStorage.removeItem(AUTH_USER_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(safeUser));
        window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      }
    } catch (error) {
      console.warn("Failed to persist user", error);
    }
  }, []);

  const updateStoredUser = useCallback((nextUser) => {
    if (typeof window === "undefined") return;
    const safeUser = sanitizeAuthUser(nextUser);
    if (!safeUser) return;
    try {
      if (window.localStorage.getItem(AUTH_USER_STORAGE_KEY)) {
        window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(safeUser));
      } else if (window.sessionStorage.getItem(AUTH_USER_STORAGE_KEY)) {
        window.sessionStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(safeUser));
      } else {
        window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(safeUser));
      }
    } catch (error) {
      console.warn("Failed to persist user", error);
    }
  }, []);

  const resetAuthState = useCallback((options = {}) => {
    clearAuthState(options);
    setUser(null);
    setAuthLoading(false);
    setAuthError("");
  }, []);

  useEffect(() => {
    if (typeof apiResponse !== "function") {
      setAuthReady(true);
      setAuthError("Authentication service is not configured.");
      return undefined;
    }

    let active = true;
    const initializeAuth = async () => {
      const storedUser = readStoredUser();
      if (storedUser && active) setUser(storedUser);

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), SESSION_VALIDATION_TIMEOUT_MS)
        : 0;

      try {
        const response = await apiResponse("/api/v1/auth/session", {
          cache: "no-store",
          signal: controller?.signal,
        });
        if (!active) return;
        if (response.ok) {
          const session = await response.json();
          const nextUser = sanitizeAuthUser(session?.user || session);
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
        if (active) setAuthReady(true);
      }
    };

    initializeAuth();
    return () => { active = false; };
  }, [apiResponse, readStoredUser, resetAuthState, updateStoredUser]);

  useEffect(() => addAuthInvalidListener(() => {
    resetAuthState();
    setAuthReady(true);
  }), [resetAuthState]);

  const login = useCallback(async (email, password, remember = true) => {
    if (typeof apiResponse !== "function") throw new Error("Authentication service is not configured.");
    setAuthLoading(true);
    setAuthError("");
    try {
      const response = await apiResponse("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Login failed");
      const safeUser = sanitizeAuthUser(payload?.user || payload);
      setUser(safeUser);
      writeStoredUser(safeUser, remember);
      return safeUser;
    } catch (error) {
      setAuthError(error?.message || "Login failed");
      throw error;
    } finally {
      setAuthLoading(false);
    }
  }, [apiResponse, writeStoredUser]);

  const logout = useCallback(() => {
    if (typeof apiResponse === "function") {
      apiResponse("/api/v1/auth/logout", {
        method: "POST",
        keepalive: true,
      }).catch((error) => console.warn("Failed to close auth session", error));
    }
    resetAuthState();
  }, [apiResponse, resetAuthState]);

  const updateUser = useCallback((nextUser) => {
    if (!nextUser) {
      setUser(null);
      resetAuthState();
      return;
    }
    const mergedUser = sanitizeAuthUser({ ...(user || {}), ...nextUser });
    setUser(mergedUser);
    updateStoredUser(mergedUser);
  }, [resetAuthState, updateStoredUser, user]);

  const value = useMemo(() => ({
    user,
    login,
    logout,
    updateUser,
    authLoading,
    authError,
    authReady,
    isAuthenticated: Boolean(user),
  }), [user, login, logout, updateUser, authLoading, authError, authReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
