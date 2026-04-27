import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredDemoAccess,
  readStoredDemoAccess,
  writeStoredDemoAccess,
} from "../utils/demoAccessSession.js";
import {
  DEFAULT_DEMO_SCENARIO_ID,
  normalizeDemoScenarioId,
} from "../data/demoScenarios.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredDemoAccess());
  const [demoScenarioId, setDemoScenarioIdState] = useState(
    () => readStoredDemoAccess()?.scenarioId || DEFAULT_DEMO_SCENARIO_ID,
  );

  useEffect(() => {
    if (user) {
      writeStoredDemoAccess(user);
      return;
    }

    clearStoredDemoAccess();
  }, [user]);

  useEffect(() => {
    if (!user?.scenarioId) {
      return;
    }

    const normalizedScenarioId = normalizeDemoScenarioId(user.scenarioId);

    if (normalizedScenarioId !== demoScenarioId) {
      setDemoScenarioIdState(normalizedScenarioId);
    }
  }, [demoScenarioId, user?.scenarioId]);

  const value = useMemo(
    () => ({
      user,
      setUser,
      demoScenarioId,
      setDemoScenarioId: (nextScenarioId) => {
        const normalizedScenarioId = normalizeDemoScenarioId(nextScenarioId);
        setDemoScenarioIdState(normalizedScenarioId);
        setUser((currentUser) =>
          currentUser
            ? {
                ...currentUser,
                scenarioId: normalizedScenarioId,
              }
            : currentUser,
        );
      },
      grantAccess: (session) => {
        const normalizedScenarioId = normalizeDemoScenarioId(
          session?.scenarioId || demoScenarioId,
        );
        setDemoScenarioIdState(normalizedScenarioId);
        setUser({
          ...session,
          scenarioId: normalizedScenarioId,
        });
      },
      revokeAccess: () => setUser(null),
      isAuthed: Boolean(user)
    }),
    [demoScenarioId, user]
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
