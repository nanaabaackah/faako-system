import React, { createContext, useContext, useEffect, useState } from "react";
import {
  addAuthInvalidListener,
  AUTH_USER_STORAGE_KEY,
  clearAuthState,
  getAuthToken,
  isAuthTokenExpired,
  setAuthToken,
} from "../../utils/organization.js";

const AuthContext = createContext(null);

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
      const storedUser = readStoredUser();
      const storedToken = getAuthToken();

      if (!storedUser && !storedToken) {
        if (isActive) setAuthReady(true);
        return;
      }

      if (!storedUser || !storedToken || isAuthTokenExpired(storedToken)) {
        resetAuthState();
        if (isActive) setAuthReady(true);
        return;
      }

      setAuthToken(storedToken);

      try {
        const response = await fetch("/.netlify/functions/authSession", {
          cache: "no-store",
        });

        if (!isActive) return;

        if (response.ok) {
          const nextUser = sanitizeUser(await response.json());
          setUser(nextUser);
          updateStoredUser(nextUser);
        } else if (response.status === 401) {
          resetAuthState();
        } else {
          setUser(storedUser);
        }
      } catch (error) {
        console.warn("Failed to validate auth session", error);
        if (isActive) {
          setUser(storedUser);
        }
      } finally {
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
      const res = await fetch("/.netlify/functions/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");
      const safeUser = sanitizeUser(data);
      setUser(safeUser);
      setAuthToken(data?.token, { remember });
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
    const token = getAuthToken();
    if (token && typeof window !== "undefined" && typeof window.fetch === "function") {
      window.fetch("/.netlify/functions/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
