import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./http.js";
import { requireUser } from "./userAuth.js";

const LEGACY_ROLE_ALIASES = {
  viewer: "staff",
  custodian: "staff",
  sales: "staff",
};

export const normalizeRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  return LEGACY_ROLE_ALIASES[normalized] || normalized;
};

export const hasAnyRole = (user, roles = []) => {
  if (!Array.isArray(roles) || roles.length === 0) return true;
  const role = normalizeRole(user?.role);
  return roles.some((allowedRole) => role === normalizeRole(allowedRole));
};

export const respond = (event, statusCode, payload = {}, options = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...buildResponseHeaders(event, options),
  },
  body: statusCode === 204 ? "" : JSON.stringify(payload),
});

export const requireInternalUser = async (
  client,
  event,
  {
    methods = "GET,POST,OPTIONS",
    roles = [],
    roleError = "Insufficient privileges.",
  } = {}
) => {
  if (isCrossSiteBrowserRequest(event)) {
    return {
      errorResponse: respond(
        event,
        403,
        { error: "Cross-site requests are not allowed." },
        { methods }
      ),
    };
  }

  const authUser = await requireUser(client, event);
  if (!authUser) {
    return {
      errorResponse: respond(event, 401, { error: "Unauthorized" }, { methods }),
    };
  }

  const organizationId = Number(authUser.organizationId);
  if (!Number.isInteger(organizationId) || organizationId <= 0) {
    return {
      errorResponse: respond(
        event,
        403,
        { error: "Organization access required." },
        { methods }
      ),
    };
  }

  if (!hasAnyRole(authUser, roles)) {
    return {
      errorResponse: respond(event, 403, { error: roleError }, { methods }),
    };
  }

  return { authUser, organizationId };
};
