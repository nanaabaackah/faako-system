import { apiPath } from "./config";

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
  token: string;
  username: string;
  role: "ADMIN" | "VIEWER";
}

export const getStoredAdminSession = (): AdminSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(ADMIN_SESSION_KEY) || "null");
    if (
      !parsed?.token ||
      !parsed?.username ||
      !["ADMIN", "VIEWER"].includes(parsed?.role)
    ) {
      return null;
    }
    return parsed as AdminSession;
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
    return { token: data.token, username: data.username, role: data.role };
  },
};
