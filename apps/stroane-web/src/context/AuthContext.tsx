import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Temporary customer profile state for the storefront account placeholder.
 * Do not store passwords or durable customer credentials in the browser.
 * Server-backed customer accounts should replace this when that product area
 * is ready.
 */

const SESSION_KEY = "stroane_guest_profile";

export interface Account {
  name: string;
  email: string;
}

interface AuthContextValue {
  user: Account | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const loadSession = (): Account | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Account;
    if (!parsed.email || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<Account | null>(loadSession);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (user) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else window.sessionStorage.removeItem(SESSION_KEY);
  }, [user]);

  const signUp = useCallback(
    async (name: string, email: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();
      if (!cleanName || !cleanEmail) {
        throw new Error("Name and email are required.");
      }
      setUser({ name: cleanName, email: cleanEmail });
    },
    []
  );

  const signIn = useCallback(async () => {
    throw new Error("Customer sign-in is not enabled yet. Use the portal for staff access.");
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, signIn, signUp, signOut }),
    [user, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
