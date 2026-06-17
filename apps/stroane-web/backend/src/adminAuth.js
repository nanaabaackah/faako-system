import { getRequestAuthToken, verifyToken } from "./auth.js";

const normalizeRole = (value) => String(value || "").trim().toUpperCase();

export const getBearerToken = (req) => {
  const authHeader = String(req.headers.authorization || "");
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
};

export const requireSiteUser = (prisma, allowedRoles = ["ADMIN"]) => async (req, res, next) => {
  const token = getRequestAuthToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const payload = verifyToken(token);
  if (!payload?.id) return res.status(401).json({ error: "Unauthorized" });

  const tokenRole = normalizeRole(payload.role);
  const allowedRoleSet = new Set(allowedRoles.map(normalizeRole));
  if (!allowedRoleSet.has(tokenRole)) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const user = await prisma.siteUser.findUnique({
      where: { id: String(payload.id) },
      select: { id: true, username: true, role: true, isActive: true },
    });

    if (!user?.isActive) return res.status(401).json({ error: "Unauthorized" });
    if (!allowedRoleSet.has(normalizeRole(user.role))) {
      return res.status(403).json({ error: "Access denied" });
    }

    req.authUser = user;
    return next();
  } catch (error) {
    console.error("Admin auth lookup failed:", {
      message: error?.message || "Unknown auth error",
    });
    return res.status(503).json({ error: "Admin authentication is unavailable" });
  }
};

export const requireAdminRole = (prisma) => requireSiteUser(prisma, ["ADMIN"]);
