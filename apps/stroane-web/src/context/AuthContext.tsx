import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Front-end-only customer auth. No server — accounts and the active session
 * live in localStorage. Passwords are SHA-256 hashed before storage so they
 * are not kept in plain text, but this is NOT a substitute for real server
 * auth and should be replaced when a backend exists.
 */

const ACCOUNTS_KEY = "stroane_accounts";
const SESSION_KEY = "stroane_session";

export interface Account {
  name: string;
  email: string;
}

interface StoredAccount extends Account {
  passwordHash: string;
}

interface AuthContextValue {
  user: Account | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const hashPassword = async (password: string): Promise<string> => {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const readAccounts = (): StoredAccount[] => {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as StoredAccount[]) : [];
  } catch {
    return [];
  }
};

const writeAccounts = (accounts: StoredAccount[]) => {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
};

const loadSession = (): Account | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
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
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }, [user]);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const cleanName = name.trim();
      if (!cleanName || !cleanEmail || !password) {
        throw new Error("All fields are required.");
      }
      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }
      const accounts = readAccounts();
      if (accounts.some((a) => a.email === cleanEmail)) {
        throw new Error("An account with this email already exists.");
      }
      const passwordHash = await hashPassword(password);
      accounts.push({ name: cleanName, email: cleanEmail, passwordHash });
      writeAccounts(accounts);
      setUser({ name: cleanName, email: cleanEmail });
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const account = readAccounts().find((a) => a.email === cleanEmail);
    if (!account) throw new Error("No account found for that email.");
    const passwordHash = await hashPassword(password);
    if (passwordHash !== account.passwordHash) {
      throw new Error("Incorrect email or password.");
    }
    setUser({ name: account.name, email: account.email });
  }, []);

  const signOut = useCallback(() => setUser(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, signIn, signUp, signOut }),
    [user, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
