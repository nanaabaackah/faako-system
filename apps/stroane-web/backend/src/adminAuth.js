import { getRequestAuthToken, verifyToken } from "./auth.js";
import {
  STROANE_ADMIN_ACTION_IDS,
  STROANE_ADMIN_MODULE_IDS,
} from "@faako/security";
import { sendApiError } from "./apiResponse.js";

const normalizeRole = (value) => String(value || "").trim().toUpperCase();
const normalizePermissionKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const SYSTEM_ROLE_KEYS = new Set(["ADMIN", "OWNER", "VIEWER", "CUSTOM"]);
export const PORTAL_AUTH_ROLES = ["ADMIN", "OWNER", "VIEWER", "CUSTOM"];

export const PORTAL_MODULES = [...STROANE_ADMIN_MODULE_IDS];

export const PORTAL_ACTIONS = [...STROANE_ADMIN_ACTION_IDS];
const VIEWER_MODULES = new Set(["dashboard", "orders", "receipts", "accounting", "crm", "inventory", "profile"]);

const createEmptyPermissions = () =>
  PORTAL_MODULES.reduce((permissions, moduleId) => {
    permissions[moduleId] = PORTAL_ACTIONS.reduce((actions, action) => {
      actions[action] = false;
      return actions;
    }, {});
    return permissions;
  }, {});

const createFullPermissions = () =>
  PORTAL_MODULES.reduce((permissions, moduleId) => {
    permissions[moduleId] = PORTAL_ACTIONS.reduce((actions, action) => {
      actions[action] = true;
      return actions;
    }, {});
    return permissions;
  }, {});

const createViewerPermissions = () =>
  PORTAL_MODULES.reduce((permissions, moduleId) => {
    permissions[moduleId] = PORTAL_ACTIONS.reduce((actions, action) => {
      actions[action] = action === "view" && VIEWER_MODULES.has(moduleId);
      return actions;
    }, {});
    return permissions;
  }, {});

export const normalizeRolePermissions = (value = {}) => {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = createEmptyPermissions();
  for (const moduleId of PORTAL_MODULES) {
    const modulePermissions = source[moduleId];
    if (!modulePermissions || typeof modulePermissions !== "object" || Array.isArray(modulePermissions)) continue;
    for (const action of PORTAL_ACTIONS) {
      normalized[moduleId][action] = modulePermissions[action] === true;
    }
  }
  normalized.profile.view = true;
  return normalized;
};

export const getSystemRolePermissions = (role) => {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "ADMIN" || normalizedRole === "OWNER") return createFullPermissions();
  return createViewerPermissions();
};

export const isElevatedSystemRole = (role) => {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "ADMIN" || normalizedRole === "OWNER";
};

export const resolveUserAccess = (user = {}) => {
  const role = normalizeRole(user.role);
  if (role === "CUSTOM") {
    const customRole = user.customRole && user.customRole.isActive !== false ? user.customRole : null;
    const permissions = customRole
      ? normalizeRolePermissions(customRole.permissions)
      : normalizeRolePermissions({});
    permissions.team = createEmptyPermissions().team;
    return {
      role,
      roleKey: customRole?.key || "custom",
      roleLabel: customRole?.name || "Custom role",
      isElevated: false,
      permissions,
    };
  }

  const safeRole = SYSTEM_ROLE_KEYS.has(role) ? role : "VIEWER";
  return {
    role: safeRole,
    roleKey: safeRole,
    roleLabel: safeRole === "OWNER" ? "Owner" : safeRole === "ADMIN" ? "Admin" : "Viewer",
    isElevated: isElevatedSystemRole(safeRole),
    permissions: getSystemRolePermissions(safeRole),
  };
};

export const userHasPermission = (user, moduleId, action = "view") => {
  const moduleKey = normalizePermissionKey(moduleId);
  const actionKey = normalizePermissionKey(action);
  if (!moduleKey || !actionKey) return false;
  const access = user?.access || resolveUserAccess(user);
  if (access.isElevated) return true;
  if (moduleKey === "team") return false;
  return access.permissions?.[moduleKey]?.[actionKey] === true;
};

export const getBearerToken = (req) => {
  const authHeader = String(req.headers.authorization || "");
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
};

export const requireSiteUser = (prisma, allowedRoles = ["ADMIN", "OWNER"]) => async (req, res, next) => {
  const token = getRequestAuthToken(req);
  if (!token) {
    return sendApiError(req, res, {
      status: 401,
      message: "Unauthorized",
    });
  }

  const payload = verifyToken(token);
  if (!payload?.id) {
    return sendApiError(req, res, {
      status: 401,
      message: "Unauthorized",
    });
  }

  const allowedRoleSet = new Set(allowedRoles.map(normalizeRole));

  try {
    const user = await prisma.siteUser.findUnique({
      where: { id: String(payload.id) },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        customRole: {
          select: {
            id: true,
            key: true,
            name: true,
            permissions: true,
            isActive: true,
          },
        },
      },
    });

    if (!user?.isActive) {
      return sendApiError(req, res, {
        status: 401,
        message: "Unauthorized",
      });
    }
    if (!allowedRoleSet.has(normalizeRole(user.role))) {
      return sendApiError(req, res, {
        status: 403,
        message: "Access denied",
      });
    }

    req.authUser = {
      ...user,
      access: resolveUserAccess(user),
    };
    return next();
  } catch (error) {
    console.error("Admin auth lookup failed:", {
      message: error?.message || "Unknown auth error",
    });
    return sendApiError(req, res, {
      status: 503,
      message: "Admin authentication is unavailable",
    });
  }
};

export const requirePermission = (moduleId, action = "edit") => (req, res, next) => {
  if (!req.authUser) {
    return sendApiError(req, res, {
      status: 401,
      message: "Unauthorized",
    });
  }
  if (!userHasPermission(req.authUser, moduleId, action)) {
    return sendApiError(req, res, {
      status: 403,
      message: "Access denied",
    });
  }
  return next();
};

export const requireAdminRole = (prisma, moduleId = "team", action = "manage") => async (req, res, next) => {
  const authorize = () => requirePermission(moduleId, action)(req, res, next);
  if (req.authUser) return authorize();
  return requireSiteUser(prisma, PORTAL_AUTH_ROLES)(req, res, authorize);
};
