import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  adminSessionApi,
  clearAdminSession,
  getStoredAdminSession,
  storeAdminSession,
  type AdminSession,
  type AdminProfileUpdatePayload,
} from "../api/adminSession";

interface AdminPortalContextValue {
  session: AdminSession | null;
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

  const signIn = useCallback(async (username: string, password: string) => {
    const nextSession = await adminSessionApi.login(username, password);
    storeAdminSession(nextSession);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(() => {
    void adminSessionApi.logout();
    clearAdminSession();
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentSession = getStoredAdminSession();
    if (!currentSession) {
      setSession(null);
      return null;
    }
    const refreshedSession = await adminSessionApi.getCurrent(currentSession);
    storeAdminSession(refreshedSession);
    setSession(refreshedSession);
    return refreshedSession;
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
    if (!session?.username) return;
    let cancelled = false;
    const currentSession = getStoredAdminSession();
    if (!currentSession) return;

    adminSessionApi.getCurrent(currentSession)
      .then((refreshedSession) => {
        if (cancelled) return;
        storeAdminSession(refreshedSession);
        setSession(refreshedSession);
      })
      .catch(() => {
        // Keep the stored session usable if the profile endpoint is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [session?.username]);

  const value = useMemo(
    () => ({ session, signIn, signOut, refreshProfile, updateProfile }),
    [refreshProfile, session, signIn, signOut, updateProfile]
  );

  return <AdminPortalContext.Provider value={value}>{children}</AdminPortalContext.Provider>;
};
