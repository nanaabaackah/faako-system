import { useEffect, useState } from "react";
import { apiGet, ApiError } from "../api/client";
import {
  clearStoredSession,
  readStoredSessionUser,
  writeStoredSession,
} from "../utils/authSession";

const listeners = new Set();

const readSnapshot = () => {
  const user = readStoredSessionUser();
  return {
    user,
    isAuthenticated: Boolean(user),
  };
};

let snapshot = readSnapshot();

const emit = () => {
  snapshot = readSnapshot();
  listeners.forEach((listener) => listener(snapshot));
};

export const getAuthSnapshot = () => snapshot;

export const subscribeAuthStore = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setAuthenticatedUser = (user) => {
  if (!user) return;
  writeStoredSession(user);
  emit();
};

export const clearAuthStore = (options = {}) => {
  clearStoredSession(options);
  emit();
};

export const refreshAuthSession = async () => {
  try {
    const payload = await apiGet("/api/auth/session", {
      cache: "no-store",
      fallbackMessage: "Unable to refresh session",
    });
    const user = payload && typeof payload === "object" ? payload.user : null;
    if (user && typeof user === "object") {
      setAuthenticatedUser(user);
      return user;
    }
    clearAuthStore();
    return null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAuthStore();
      return null;
    }
    throw error;
  }
};

export const useAuthSnapshot = () => {
  const [state, setState] = useState(getAuthSnapshot);

  useEffect(() => subscribeAuthStore(setState), []);

  return state;
};
