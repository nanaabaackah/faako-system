import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredDemoAccess,
  readStoredDemoAccess,
  writeStoredDemoAccess,
} from "../utils/demoAccessSession.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredDemoAccess());

  useEffect(() => {
    if (user) {
      writeStoredDemoAccess(user);
      return;
    }

    clearStoredDemoAccess();
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      grantAccess: (session) => setUser(session),
      revokeAccess: () => setUser(null),
      isAuthed: Boolean(user)
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
