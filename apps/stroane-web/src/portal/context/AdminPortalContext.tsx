import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  adminSessionApi,
  clearAdminSession,
  getStoredAdminSession,
  isAdminUnauthorizedError,
  storeAdminSession,
  type AdminSession,
  type AdminProfileUpdatePayload,
} from "../api/adminSession";

interface AdminPortalContextValue {
  session: AdminSession | null;
  authChecking: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshProfile: () => Promise<AdminSession | null>;
  updateProfile: (payload: AdminProfileUpdatePayload) => Promise<AdminSession>;
}

const AdminPortalContext = createContext<AdminPortalContextValue | null>(null);

export const useAdminPortal = (): AdminPortalContextValue => {
  const context = useContext(AdminPortalContext);
  if (!context) throw new Error("useAdminPortal must be used within AdminPortalProvider");
  return context;
};

export const AdminPortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AdminSession | null>(() => getStoredAdminSession());
  const [authChecking, setAuthChecking] = useState(() => Boolean(getStoredAdminSession()));

  const signIn = useCallback(async (username: string, password: string) => {
    const nextSession = await adminSessionApi.login(username, password);
    storeAdminSession(nextSession);
    setSession(nextSession);
    setAuthChecking(false);
  }, []);

  const signOut = useCallback(() => {
    void adminSessionApi.logout();
    clearAdminSession();
    setSession(null);
    setAuthChecking(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentSession = getStoredAdminSession();
    if (!currentSession) {
      setSession(null);
      setAuthChecking(false);
      return null;
    }
    setAuthChecking(true);
    try {
      const refreshedSession = await adminSessionApi.getCurrent(currentSession);
      storeAdminSession(refreshedSession);
      setSession(refreshedSession);
      return refreshedSession;
    } catch (error) {
      if (isAdminUnauthorizedError(error)) {
        clearAdminSession();
        setSession(null);
      }
      throw error;
    } finally {
      setAuthChecking(false);
    }
  }, []);

  const updateProfile = useCallback(async (payload: AdminProfileUpdatePayload) => {
    const currentSession = getStoredAdminSession();
    if (!currentSession) throw new Error("Sign in again to update your profile.");
    const nextSession = await adminSessionApi.updateProfile(currentSession, payload);
    storeAdminSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, []);

  useEffect(() => {
    if (!session?.username) {
      setAuthChecking(false);
      return;
    }
    let cancelled = false;
    const currentSession = getStoredAdminSession();
    if (!currentSession) {
      clearAdminSession();
      setSession(null);
      setAuthChecking(false);
      return;
    }

    setAuthChecking(true);
    adminSessionApi.getCurrent(currentSession)
      .then((refreshedSession) => {
        if (cancelled) return;
        storeAdminSession(refreshedSession);
        setSession(refreshedSession);
      })
      .catch((error) => {
        if (cancelled) return;
        if (isAdminUnauthorizedError(error)) {
          clearAdminSession();
          setSession(null);
        }
        // Non-auth failures can be temporary API/network issues; keep the profile shell.
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.username]);

  const value = useMemo(
    () => ({ session, authChecking, signIn, signOut, refreshProfile, updateProfile }),
    [authChecking, refreshProfile, session, signIn, signOut, updateProfile]
  );

  return <AdminPortalContext.Provider value={value}>{children}</AdminPortalContext.Provider>;
};
