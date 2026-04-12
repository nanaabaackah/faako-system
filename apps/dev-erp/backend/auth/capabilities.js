import { resolveMountedRequestPath } from "./auth.middleware.js";

const normalizeModuleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const toMatcher = (matcher) => {
  if (matcher instanceof RegExp) return matcher;
  if (typeof matcher === "function") return matcher;
  return new RegExp(String(matcher || "$.^"));
};

const routeMatches = (matcher, requestPath, req) => {
  if (typeof matcher === "function") {
    return Boolean(matcher(requestPath, req));
  }
  matcher.lastIndex = 0;
  return matcher.test(requestPath);
};

export const normalizeCapabilityModules = (modules) => {
  const source = Array.isArray(modules) ? modules : [modules];
  return Array.from(new Set(source.map(normalizeModuleName).filter(Boolean)));
};

export const createCapabilityAccessMiddleware =
  ({
    resolveAuthenticatedPayload,
    extractAllowedModules,
    routeCapabilities = [],
    publicPathMatchers = [],
    unrestrictedRoleNames = ["Admin"],
    errorMessage = "You do not have access to this module.",
  }) =>
  async (req, res, next) => {
    try {
      const requestPath = resolveMountedRequestPath(req);
      const publicMatchers = publicPathMatchers.map(toMatcher);
      if (publicMatchers.some((matcher) => routeMatches(matcher, requestPath, req))) {
        return next();
      }

      const capability = routeCapabilities.find((entry) => {
        const matcher = toMatcher(entry.matcher ?? entry.pattern);
        return routeMatches(matcher, requestPath, req);
      });
      if (!capability) {
        return next();
      }

      const payload = req.user || (await resolveAuthenticatedPayload(req));
      if (!payload) {
        return next();
      }

      const roleName = normalizeRoleName(payload.roleName ?? payload.role?.name);
      const unrestrictedRoles = new Set(unrestrictedRoleNames.map(normalizeRoleName));
      if (roleName && unrestrictedRoles.has(roleName)) {
        return next();
      }

      const modules = normalizeCapabilityModules(
        typeof extractAllowedModules === "function"
          ? extractAllowedModules({ modules: payload.modules ?? payload.allowedModules ?? [] })
          : payload.modules ?? payload.allowedModules ?? []
      );

      const acceptedModules = normalizeCapabilityModules(
        capability.modules ?? capability.module ?? capability.moduleKey
      );
      if (acceptedModules.some((module) => modules.includes(module))) {
        return next();
      }

      return res.status(403).json({
        error: capability.errorMessage || errorMessage,
        requiredModules: acceptedModules,
      });
    } catch (error) {
      return next(error);
    }
  };
