/* eslint-disable no-undef */
import { isCrossSiteBrowserRequest, isTrustedBrowserMutation, json } from "./http.js";
import { hasPermissionIdentifier } from "@faako/security";
import {
  applyRequestOrganizationContext,
  resolveAuthorizedOrganizationId,
} from "./organization.js";
import {
  getBearerUserTokenFromEvent,
  getCookieUserTokenFromEvent,
  requireUser,
} from "./userAuth.js";

export const SYSTEM_ADMIN_EMAIL = String(
  process.env.SYSTEM_ADMIN_EMAIL || "system_admin@reebs.com"
)
  .trim()
  .toLowerCase();

const LEGACY_ROLE_ALIASES = {
  viewer: "staff",
  custodian: "staff",
  sales: "staff",
};

const ROLE_PERMISSIONS = {
  owner: ["*"],
  admin: ["*"],
  manager: [
    "inventory:read",
    "inventory:write",
    "inventory:approve",
    "orders:read",
    "orders:write",
    "bookings:read",
    "bookings:write",
    "customers:read",
    "customers:write",
    "deliveries:read",
    "deliveries:write",
    "maintenance:read",
    "maintenance:write",
    "financials:read",
    "documents:read",
    "documents:write",
    "invoices:read",
    "invoices:write",
    "marketing:read",
    "marketing:write",
    "expenses:read",
    "expenses:write",
    "commercial-config:view",
    "timesheets:manage",
    "vendors:read",
    "vendors:write",
    "users:read",
    "website-content:write",
  ],
  warehouse: [
    "inventory:read",
    "inventory:write",
    "maintenance:read",
    "maintenance:write",
  ],
  staff: [
    "inventory:read",
    "orders:read",
    "orders:write",
    "bookings:read",
    "bookings:write",
    "customers:read",
    "customers:write",
  ],
  driver: [
    "orders:read",
    "bookings:read",
    "customers:read",
    "deliveries:read",
    "deliveries:write",
  ],
  water: ["water:read", "water:write", "water-pricing:view"],
};

export const normalizeRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return LEGACY_ROLE_ALIASES[normalized] || normalized;
};

export const isSystemAdminUser = (user) =>
  String(user?.email || "").trim().toLowerCase() === SYSTEM_ADMIN_EMAIL;

export const hasAnyRole = (user, roles = []) => {
  if (!Array.isArray(roles) || roles.length === 0) return true;
  const role = normalizeRole(user?.role);
  return roles.some((allowedRole) => role === normalizeRole(allowedRole));
};

export const hasPermission = (user, permission) => {
  if (!permission) return true;
  if (isSystemAdminUser(user)) return true;

  const role = normalizeRole(user?.role);
  const permissions = ROLE_PERMISSIONS[role] || [];
  return hasPermissionIdentifier(permissions, permission);
};

export const respond = (event, statusCode, payload = {}, options = {}) =>
  json(event, statusCode, payload, options);

export const isProductionRuntime = (env = process.env) => {
  const runtime = String(env?.APP_ENV || env?.NODE_ENV || "")
    .trim()
    .toLowerCase();
  return runtime === "production" || runtime === "prod";
};

export const assertSeedActionsAllowed = (env = process.env) => {
  if (isProductionRuntime(env)) {
    const error = new Error("Seed actions are disabled in production.");
    error.statusCode = 403;
    throw error;
  }

  if (String(env?.SEED_ENABLED || "").trim().toLowerCase() !== "true") {
    const error = new Error(
      "Seed actions are disabled. Set SEED_ENABLED=true to enable."
    );
    error.statusCode = 403;
    throw error;
  }
};

const buildForbiddenResponse = (event, methods, message) =>
  respond(event, 403, { error: message }, { methods });

const requireScopedUser = async (
  client,
  event,
  {
    methods = "GET,POST,OPTIONS",
    roles = [],
    permission = "",
    roleError = "Insufficient privileges.",
    permissionError = "Insufficient privileges.",
    body = null,
    allowCrossOrgForRoles = [],
  } = {}
) => {
  if (isCrossSiteBrowserRequest(event)) {
    return {
      errorResponse: buildForbiddenResponse(
        event,
        methods,
        "Cross-site requests are not allowed."
      ),
    };
  }

  const hasCookieCredential = Boolean(getCookieUserTokenFromEvent(event));
  const usesBearerCredential = !hasCookieCredential && Boolean(getBearerUserTokenFromEvent(event));
  if (!usesBearerCredential && !isTrustedBrowserMutation(event)) {
    return {
      errorResponse: buildForbiddenResponse(
        event,
        methods,
        "Request origin could not be verified."
      ),
    };
  }

  const authUser = await requireUser(client, event);
  if (!authUser) {
    return {
      errorResponse: respond(event, 401, { error: "Unauthorized" }, { methods }),
    };
  }

  if (!hasAnyRole(authUser, roles)) {
    return {
      errorResponse: buildForbiddenResponse(event, methods, roleError),
    };
  }

  if (!hasPermission(authUser, permission)) {
    return {
      errorResponse: buildForbiddenResponse(event, methods, permissionError),
    };
  }

  try {
    const organizationId = await resolveAuthorizedOrganizationId(client, {
      authUser,
      event,
      body,
      allowCrossOrgForRoles,
    });
    await applyRequestOrganizationContext(client, organizationId);
    return {
      authUser: { ...authUser, organizationId },
      organizationId,
    };
  } catch (error) {
    return {
      errorResponse: respond(
        event,
        error?.statusCode || 403,
        { error: error?.message || "Insufficient privileges." },
        { methods }
      ),
    };
  }
};

export const requireInternalUser = async (client, event, options = {}) =>
  requireScopedUser(client, event, options);

export const requireAdmin = async (client, event, options = {}) =>
  requireScopedUser(client, event, {
    ...options,
    roles: ["owner", "admin"],
    roleError: options.roleError || "Only owners and admins can access this resource.",
  });

export const requireManager = async (client, event, options = {}) =>
  requireScopedUser(client, event, {
    ...options,
    roles: ["owner", "admin", "manager"],
    roleError:
      options.roleError || "Only owners, admins, and managers can access this resource.",
  });

export const requirePermission = async (
  client,
  event,
  permission,
  options = {}
) =>
  requireScopedUser(client, event, {
    ...options,
    permission,
    permissionError:
      options.permissionError || "You do not have permission to access this resource.",
  });
