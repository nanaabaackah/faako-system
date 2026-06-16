import { apiPath } from "../../api/config";

const ADMIN_SESSION_KEY = "stroane_admin_session_v1";

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : fallbackMessage;
    throw new Error(message);
  }

  if (!body) throw new Error(fallbackMessage);
  return body as T;
};

export interface AdminSession {
  id?: string;
  token: string;
  username: string;
  role: "ADMIN" | "VIEWER";
  firstName?: string;
  lastName?: string;
  displayName?: string;
  personalEmail?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  avatarUrl?: string;
  appearancePreference?: AdminAppearancePreference;
}

export type AdminAppearancePreference = "system" | "light" | "dark";

export interface AdminProfileUpdatePayload {
  username?: string;
  firstName?: string;
  lastName?: string;
  personalEmail?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  bio?: string;
  avatarUrl?: string;
  appearancePreference?: AdminAppearancePreference;
}

const normalizeAppearancePreference = (value: unknown): AdminAppearancePreference =>
  value === "light" || value === "dark" ? value : "system";

const normalizeAdminSession = (candidate: unknown): AdminSession | null => {
  const parsed = candidate as AdminSession | null;
  if (
    !parsed?.token ||
    !parsed?.username ||
    !["ADMIN", "VIEWER"].includes(parsed?.role)
  ) {
    return null;
  }

  return {
    ...parsed,
    firstName: parsed.firstName || "",
    lastName: parsed.lastName || "",
    displayName:
      parsed.displayName ||
      [parsed.firstName, parsed.lastName].filter(Boolean).join(" ") ||
      parsed.username,
    personalEmail: parsed.personalEmail || "",
    phone: parsed.phone || "",
    jobTitle: parsed.jobTitle || "",
    department: parsed.department || "",
    bio: parsed.bio || "",
    avatarUrl: parsed.avatarUrl || "",
    appearancePreference: normalizeAppearancePreference(parsed.appearancePreference),
  };
};

export const getStoredAdminSession = (): AdminSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ADMIN_SESSION_KEY) || "null");
    return normalizeAdminSession(parsed);
  } catch {
    return null;
  }
};

export const storeAdminSession = (session: AdminSession) => {
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
};

export const clearAdminSession = () => {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
};

export const adminSessionApi = {
  async login(username: string, password: string): Promise<AdminSession> {
    const response = await fetch(apiPath("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse<{
      ok: boolean;
      token: string;
      username: string;
      role: "ADMIN" | "VIEWER";
    }>(response, "Unable to sign in.");
    const session = normalizeAdminSession(data);
    if (!session) throw new Error("Unable to sign in.");
    return session;
  },

  async getCurrent(session: AdminSession): Promise<AdminSession> {
    const response = await fetch(apiPath("/api/auth/me"), {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const data = await parseJsonResponse<{ ok: boolean; user: AdminSession }>(
      response,
      "Unable to load profile."
    );
    const nextSession = normalizeAdminSession({ ...data.user, token: session.token });
    if (!nextSession) throw new Error("Unable to load profile.");
    return nextSession;
  },

  async updateProfile(
    session: AdminSession,
    payload: AdminProfileUpdatePayload
  ): Promise<AdminSession> {
    const response = await fetch(apiPath("/api/auth/me"), {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<AdminSession>(response, "Unable to update profile.");
    const nextSession = normalizeAdminSession(data);
    if (!nextSession) throw new Error("Unable to update profile.");
    return nextSession;
  },
};

export const getAdminDisplayName = (session: AdminSession | null | undefined) =>
  session?.displayName ||
  [session?.firstName, session?.lastName].filter(Boolean).join(" ") ||
  session?.username ||
  "";

export const getAdminSalutationName = (session: AdminSession | null | undefined) =>
  session?.firstName || getAdminDisplayName(session);
