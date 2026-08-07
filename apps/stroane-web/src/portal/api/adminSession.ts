import { isApiClientError, type ApiRequestOptions } from "@faako/api-client";
import {
  STROANE_ADMIN_ACTION_IDS,
  STROANE_ADMIN_MODULE_IDS,
} from "@faako/security";
import { stroaneApiClient } from "../../api/client";

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

const adminRequest = async <T>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> => {
  try {
    return await stroaneApiClient.request<T>(path, { ...options, method });
  } catch (error) {
    if (isApiClientError(error)) {
      throw new AdminApiError(error.message, error.status);
    }
    throw error;
  }
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
    const data = await adminRequest<{
      ok: boolean;
      username: string;
      role: AdminRole;
      roleKey?: string;
      roleLabel?: string;
      permissions?: AdminRolePermissions;
    }>("POST", "/api/auth/login", {
      json: { username, password },
      fallbackMessage: "Unable to sign in.",
    });
    const session = normalizeAdminSession(data);
    if (!session) throw new Error("Unable to sign in.");
    return session;
  },

  async getCurrent(session: AdminSession): Promise<AdminSession> {
    const data = await adminRequest<{ ok: boolean; user: AdminSession }>(
      "GET",
      "/api/auth/me",
      { fallbackMessage: "Unable to load profile." }
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

    const data = await adminRequest<AdminSession>("PATCH", "/api/auth/me", {
      json: payload,
      fallbackMessage: "Unable to update profile.",
    });
    const nextSession = normalizeAdminSession(data);
    if (!nextSession) throw new Error("Unable to update profile.");
    return nextSession;
  },

  async logout(): Promise<void> {
    await adminRequest("POST", "/api/auth/logout", {
      fallbackMessage: "Unable to sign out.",
    }).catch(() => undefined);
  },

  async listUsers(): Promise<AdminTeamUser[]> {
    const data = await adminRequest<{ ok: boolean; users: AdminTeamUser[] }>(
      "GET",
      "/api/auth/users",
      { fallbackMessage: "Unable to load portal users." }
    );
    return Array.isArray(data.users) ? data.users : [];
  },

  async createUser(payload: AdminCreateUserPayload): Promise<AdminTeamUser> {
    const data = await adminRequest<{ ok: boolean; user: AdminTeamUser }>(
      "POST",
      "/api/auth/users",
      { json: payload, fallbackMessage: "Unable to create portal user." }
    );
    return data.user;
  },

  async listRoles(): Promise<AdminRoleDefinition[]> {
    const data = await adminRequest<{ ok: boolean; roles: AdminRoleDefinition[] }>(
      "GET",
      "/api/auth/roles",
      { fallbackMessage: "Unable to load portal roles." }
    );
    return Array.isArray(data.roles)
      ? data.roles.map(normalizeRoleDefinition).filter((role): role is AdminRoleDefinition => Boolean(role))
      : [];
  },

  async createRole(payload: AdminCreateRolePayload): Promise<AdminRoleDefinition> {
    const data = await adminRequest<{ ok: boolean; role: AdminRoleDefinition }>(
      "POST",
      "/api/auth/roles",
      { json: payload, fallbackMessage: "Unable to create portal role." }
    );
    const role = normalizeRoleDefinition(data.role);
    if (!role) throw new Error("Unable to create portal role.");
    return role;
  },

  async updateRole(id: string, payload: AdminUpdateRolePayload): Promise<AdminRoleDefinition> {
    const data = await adminRequest<{ ok: boolean; role: AdminRoleDefinition }>(
      "PATCH",
      `/api/auth/roles/${encodeURIComponent(id)}`,
      { json: payload, fallbackMessage: "Unable to update portal role." }
    );
    const role = normalizeRoleDefinition(data.role);
    if (!role) throw new Error("Unable to update portal role.");
    return role;
  },

  async updateUser(id: string, payload: AdminUpdateUserPayload): Promise<AdminTeamUser> {
    const data = await adminRequest<{ ok: boolean; user: AdminTeamUser }>(
      "PATCH",
      `/api/auth/users/${encodeURIComponent(id)}`,
      { json: payload, fallbackMessage: "Unable to update portal user." }
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
