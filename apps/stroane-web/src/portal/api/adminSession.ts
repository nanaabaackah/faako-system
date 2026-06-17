import { apiPath } from "../../api/config";

const ADMIN_SESSION_KEY = "stroane_admin_session_v1";

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export const isAdminUnauthorizedError = (error: unknown) =>
  error instanceof AdminApiError && error.status === 401;

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : fallbackMessage;
    throw new AdminApiError(message, response.status);
  }

  if (!body) throw new Error(fallbackMessage);
  return body as T;
};

export interface AdminSession {
  id?: string;
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
    !parsed?.username ||
    !["ADMIN", "VIEWER"].includes(parsed?.role)
  ) {
    return null;
  }

  const safeParsed = { ...(parsed as AdminSession & { token?: string }) };
  delete safeParsed.token;

  return {
    ...safeParsed,
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
  const profile = { ...(session as AdminSession & { token?: string }) };
  delete profile.token;
  const { username, role } = profile;
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ ...profile, username, role }));
};

export const clearAdminSession = () => {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
};

export const adminSessionApi = {
  async login(username: string, password: string): Promise<AdminSession> {
    const response = await fetch(apiPath("/api/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonResponse<{
      ok: boolean;
      username: string;
      role: "ADMIN" | "VIEWER";
    }>(response, "Unable to sign in.");
    const session = normalizeAdminSession(data);
    if (!session) throw new Error("Unable to sign in.");
    return session;
  },

  async getCurrent(session: AdminSession): Promise<AdminSession> {
    const response = await fetch(apiPath("/api/auth/me"), {
      credentials: "include",
    });
    const data = await parseJsonResponse<{ ok: boolean; user: AdminSession }>(
      response,
      "Unable to load profile."
    );
    const nextSession = normalizeAdminSession({ ...session, ...data.user });
    if (!nextSession) throw new Error("Unable to load profile.");
    return nextSession;
  },

  async updateProfile(
    session: AdminSession,
    payload: AdminProfileUpdatePayload
  ): Promise<AdminSession> {
    if (!session?.username) throw new Error("Sign in again to update your profile.");

    const response = await fetch(apiPath("/api/auth/me"), {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<AdminSession>(response, "Unable to update profile.");
    const nextSession = normalizeAdminSession(data);
    if (!nextSession) throw new Error("Unable to update profile.");
    return nextSession;
  },

  async logout(): Promise<void> {
    await fetch(apiPath("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
  },
};

export const getAdminDisplayName = (session: AdminSession | null | undefined) =>
  session?.displayName ||
  [session?.firstName, session?.lastName].filter(Boolean).join(" ") ||
  session?.username ||
  "";

export const getAdminSalutationName = (session: AdminSession | null | undefined) =>
  session?.firstName || getAdminDisplayName(session);
