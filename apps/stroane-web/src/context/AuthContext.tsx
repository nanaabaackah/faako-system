import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  customerAccountApi,
  type CustomerProfile,
  type CustomerProfileUpdatePayload,
  type CustomerSignupPayload,
} from "../api/customerAccount";

const CUSTOMER_PROFILE_KEY = "stroane_customer_profile_v1";

interface AuthContextValue {
  user: CustomerProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<CustomerProfile>;
  signUp: (payload: CustomerSignupPayload) => Promise<CustomerProfile>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<CustomerProfile | null>;
  updateProfile: (payload: CustomerProfileUpdatePayload) => Promise<CustomerProfile>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const normalizeStoredProfile = (value: unknown): CustomerProfile | null => {
  const candidate = value as CustomerProfile | null;
  if (!candidate?.id || !candidate.email || !candidate.name) return null;
  return {
    ...candidate,
    status: candidate.status || "active",
    preferredContactMethod: candidate.preferredContactMethod || "email",
  };
};

const loadStoredProfile = (): CustomerProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    return normalizeStoredProfile(
      JSON.parse(window.sessionStorage.getItem(CUSTOMER_PROFILE_KEY) || "null")
    );
  } catch {
    return null;
  }
};

const storeProfile = (profile: CustomerProfile | null) => {
  if (typeof window === "undefined") return;
  if (!profile) {
    window.sessionStorage.removeItem(CUSTOMER_PROFILE_KEY);
    return;
  }
  window.sessionStorage.setItem(CUSTOMER_PROFILE_KEY, JSON.stringify(profile));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerProfile | null>(loadStoredProfile);
  const [loading, setLoading] = useState(false);

  const applyProfile = useCallback((profile: CustomerProfile | null) => {
    storeProfile(profile);
    setUser(profile);
    return profile;
  }, []);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await customerAccountApi.getCurrent();
      return applyProfile(profile);
    } catch {
      return applyProfile(null);
    } finally {
      setLoading(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    if (!user) return;
    void refreshProfile();
    // Refresh once after startup when a profile shell exists. Avoid putting the
    // full user object in deps so profile edits do not create a refresh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const profile = await customerAccountApi.login({ email, password });
      return applyProfile(profile);
    },
    [applyProfile]
  );

  const signUp = useCallback(
    async (payload: CustomerSignupPayload) => {
      const profile = await customerAccountApi.signup(payload);
      return applyProfile(profile);
    },
    [applyProfile]
  );

  const signOut = useCallback(async () => {
    await customerAccountApi.logout();
    applyProfile(null);
  }, [applyProfile]);

  const updateProfile = useCallback(
    async (payload: CustomerProfileUpdatePayload) => {
      const profile = await customerAccountApi.updateProfile(payload);
      return applyProfile(profile);
    },
    [applyProfile]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signIn, signUp, signOut, refreshProfile, updateProfile }),
    [loading, refreshProfile, signIn, signOut, signUp, updateProfile, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
