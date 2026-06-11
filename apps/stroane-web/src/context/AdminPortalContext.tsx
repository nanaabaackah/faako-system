import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  adminSessionApi,
  clearAdminSession,
  getStoredAdminSession,
  storeAdminSession,
  type AdminSession,
} from "../api/adminSession";

interface AdminPortalContextValue {
  session: AdminSession | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
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
    clearAdminSession();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <AdminPortalContext.Provider value={value}>{children}</AdminPortalContext.Provider>;
};
