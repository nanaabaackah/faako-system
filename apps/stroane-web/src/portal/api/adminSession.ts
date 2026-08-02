import { apiPath } from "../../api/config";
import {
  STROANE_ADMIN_ACTION_IDS,
  STROANE_ADMIN_MODULE_IDS,
} from "@faako/security";

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
  role: AdminRole;
  roleKey?: string;
  roleLabel?: string;
  permissions?: AdminRolePermissions;
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

export const ADMIN_ROLES = ["ADMIN", "OWNER", "VIEWER", "CUSTOM"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export type AdminAppearancePreference = "system" | "light" | "dark";

export const ADMIN_ROLE_MODULES = STROANE_ADMIN_MODULE_IDS;

export const ADMIN_ROLE_ACTIONS = STROANE_ADMIN_ACTION_IDS;

export type AdminRoleModule = (typeof ADMIN_ROLE_MODULES)[number];
export type AdminRoleAction = (typeof ADMIN_ROLE_ACTIONS)[number];
export type AdminRolePermissions = Record<AdminRoleModule, Record<AdminRoleAction, boolean>>;

export interface AdminRoleDefinition {
  id: string;
  key: string;
  name: string;
  description?: string;
  permissions: AdminRolePermissions;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminTeamUser {
  id: string;
  username: string;
  role: AdminRole;
  roleKey?: string;
  roleLabel?: string;
  customRoleId?: string | null;
  permissions?: AdminRolePermissions;
  isActive: boolean;
  createdAt?: string;
  createdBy?: {
    username?: string;
  } | null;
}

export interface AdminCreateUserPayload {
  username: string;
  password: string;
  role?: AdminRole;
  roleKey?: string;
  customRoleId?: string;
}

export interface AdminUpdateUserPayload {
  role?: AdminRole;
  roleKey?: string;
  customRoleId?: string;
  isActive?: boolean;
}

export interface AdminCreateRolePayload {
  key?: string;
  name: string;
  description?: string;
  permissions: AdminRolePermissions;
}

export interface AdminUpdateRolePayload {
  name?: string;
  description?: string;
  permissions?: AdminRolePermissions;
  isActive?: boolean;
}

export interface AdminProfileUpdatePayload {
  username?: string;
  newPassword?: string;
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

const isAdminRole = (value: unknown): value is AdminRole =>
  ADMIN_ROLES.includes(String(value || "").toUpperCase() as AdminRole);

const normalizeAdminRole = (value: unknown): AdminRole | null => {
  const normalized = String(value || "").toUpperCase();
  return isAdminRole(normalized) ? normalized : null;
};

const createEmptyPermissions = (): AdminRolePermissions =>
  ADMIN_ROLE_MODULES.reduce((permissions, moduleId) => {
    permissions[moduleId] = ADMIN_ROLE_ACTIONS.reduce((actions, action) => {
      actions[action] = false;
      return actions;
    }, {} as Record<AdminRoleAction, boolean>);
    return permissions;
  }, {} as AdminRolePermissions);

const createFullPermissions = (): AdminRolePermissions =>
  ADMIN_ROLE_MODULES.reduce((permissions, moduleId) => {
    permissions[moduleId] = ADMIN_ROLE_ACTIONS.reduce((actions, action) => {
      actions[action] = true;
      return actions;
    }, {} as Record<AdminRoleAction, boolean>);
    return permissions;
  }, {} as AdminRolePermissions);

const createViewerPermissions = (): AdminRolePermissions => {
  const viewerModules = new Set<AdminRoleModule>([
    "dashboard",
    "orders",
    "receipts",
    "accounting",
    "crm",
    "inventory",
    "profile",
  ]);
  const permissions = createEmptyPermissions();
  ADMIN_ROLE_MODULES.forEach((moduleId) => {
    permissions[moduleId].view = viewerModules.has(moduleId);
  });
  return permissions;
};

export const getFallbackRolePermissions = (role: AdminRole): AdminRolePermissions => {
  if (role === "ADMIN" || role === "OWNER") return createFullPermissions();
  if (role === "VIEWER") return createViewerPermissions();
  return createEmptyPermissions();
};

export const normalizeRolePermissions = (
  candidate: unknown,
  fallbackRole: AdminRole = "VIEWER"
): AdminRolePermissions => {
  const source =
    candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? (candidate as Partial<Record<AdminRoleModule, Partial<Record<AdminRoleAction, boolean>>>>)
      : getFallbackRolePermissions(fallbackRole);
  const permissions = createEmptyPermissions();

  ADMIN_ROLE_MODULES.forEach((moduleId) => {
    const modulePermissions = source[moduleId];
    if (!modulePermissions || typeof modulePermissions !== "object") return;
    ADMIN_ROLE_ACTIONS.forEach((action) => {
      permissions[moduleId][action] = modulePermissions[action] === true;
    });
  });

  permissions.profile.view = true;
  return permissions;
};

const normalizeRoleDefinition = (candidate: unknown): AdminRoleDefinition | null => {
  const parsed = candidate as AdminRoleDefinition | null;
  if (!parsed?.key || !parsed?.name) return null;
  const key = String(parsed.key);
  const role = normalizeAdminRole(key) || "CUSTOM";
  return {
    id: String(parsed.id || key),
    key,
    name: String(parsed.name),
    description: parsed.description ? String(parsed.description) : "",
    permissions: normalizeRolePermissions(parsed.permissions, role),
    isSystem: Boolean(parsed.isSystem),
    isActive: parsed.isActive !== false,
    createdAt: parsed.createdAt,
    updatedAt: parsed.updatedAt,
  };
};

const normalizeAdminSession = (candidate: unknown): AdminSession | null => {
  const parsed = candidate as AdminSession | null;
  const role = normalizeAdminRole(parsed?.role);
  if (!parsed?.username || !role) {
    return null;
  }

  const safeParsed = { ...(parsed as AdminSession & { token?: string }) };
  delete safeParsed.token;

  return {
    ...safeParsed,
    role,
    roleKey: parsed.roleKey || role,
    roleLabel:
      parsed.roleLabel ||
      (role === "OWNER" ? "Owner" : role === "ADMIN" ? "Admin" : role === "CUSTOM" ? "Custom role" : "Viewer"),
    permissions: normalizeRolePermissions(parsed.permissions, role),
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
      role: AdminRole;
      roleKey?: string;
      roleLabel?: string;
      permissions?: AdminRolePermissions;
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

  async listUsers(): Promise<AdminTeamUser[]> {
    const response = await fetch(apiPath("/api/auth/users"), {
      credentials: "include",
    });
    const data = await parseJsonResponse<{ ok: boolean; users: AdminTeamUser[] }>(
      response,
      "Unable to load portal users."
    );
    return Array.isArray(data.users) ? data.users : [];
  },

  async createUser(payload: AdminCreateUserPayload): Promise<AdminTeamUser> {
    const response = await fetch(apiPath("/api/auth/users"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ ok: boolean; user: AdminTeamUser }>(
      response,
      "Unable to create portal user."
    );
    return data.user;
  },

  async listRoles(): Promise<AdminRoleDefinition[]> {
    const response = await fetch(apiPath("/api/auth/roles"), {
      credentials: "include",
    });
    const data = await parseJsonResponse<{ ok: boolean; roles: AdminRoleDefinition[] }>(
      response,
      "Unable to load portal roles."
    );
    return Array.isArray(data.roles)
      ? data.roles.map(normalizeRoleDefinition).filter((role): role is AdminRoleDefinition => Boolean(role))
      : [];
  },

  async createRole(payload: AdminCreateRolePayload): Promise<AdminRoleDefinition> {
    const response = await fetch(apiPath("/api/auth/roles"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ ok: boolean; role: AdminRoleDefinition }>(
      response,
      "Unable to create portal role."
    );
    const role = normalizeRoleDefinition(data.role);
    if (!role) throw new Error("Unable to create portal role.");
    return role;
  },

  async updateRole(id: string, payload: AdminUpdateRolePayload): Promise<AdminRoleDefinition> {
    const response = await fetch(apiPath(`/api/auth/roles/${encodeURIComponent(id)}`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ ok: boolean; role: AdminRoleDefinition }>(
      response,
      "Unable to update portal role."
    );
    const role = normalizeRoleDefinition(data.role);
    if (!role) throw new Error("Unable to update portal role.");
    return role;
  },

  async updateUser(id: string, payload: AdminUpdateUserPayload): Promise<AdminTeamUser> {
    const response = await fetch(apiPath(`/api/auth/users/${encodeURIComponent(id)}`), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse<{ ok: boolean; user: AdminTeamUser }>(
      response,
      "Unable to update portal user."
    );
    return data.user;
  },
};

export const getAdminDisplayName = (session: AdminSession | null | undefined) =>
  session?.displayName ||
  [session?.firstName, session?.lastName].filter(Boolean).join(" ") ||
  session?.username ||
  "";

export const getAdminSalutationName = (session: AdminSession | null | undefined) =>
  session?.firstName || getAdminDisplayName(session);

export const hasPortalPermission = (
  session: AdminSession | null | undefined,
  moduleId: AdminRoleModule,
  action: AdminRoleAction = "view"
) => {
  if (!session) return false;
  if (session.role === "ADMIN" || session.role === "OWNER") return true;
  return session.permissions?.[moduleId]?.[action] === true;
};

export const canAccessPortalModule = (
  session: AdminSession | null | undefined,
  moduleId: AdminRoleModule
) => hasPortalPermission(session, moduleId, "view");
