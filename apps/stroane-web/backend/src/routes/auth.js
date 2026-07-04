import { Router } from "express";
import {
  clearAdminAuthCookie,
  getRequestAuthToken,
  hashPassword,
  safeVerifyPassword,
  setAdminAuthCookie,
  signToken,
  verifyToken,
} from "../auth.js";
import {
  PORTAL_ACTIONS,
  PORTAL_MODULES,
  getSystemRolePermissions,
  normalizeRolePermissions,
  resolveUserAccess,
} from "../adminAuth.js";

const MAX_USERNAME_LEN = 50;
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 100;
const MAX_AVATAR_URL_LEN = 350000;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const ROLE_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]$/;
const SYSTEM_ROLES = new Set(["ADMIN", "OWNER", "VIEWER"]);
const RESERVED_ROLE_KEYS = new Set(["ADMIN", "OWNER", "VIEWER", "CUSTOM", "admin", "owner", "viewer", "custom"]);
const APPEARANCE_PREFERENCES = new Set(["system", "light", "dark"]);
const PROFILE_FIELD_LIMITS = {
  firstName: 80,
  lastName: 80,
  personalEmail: 180,
  phone: 40,
  jobTitle: 120,
  department: 120,
  bio: 600,
};

const PROFILE_SELECT = {
  id: true,
  username: true,
  role: true,
  isActive: true,
  firstName: true,
  lastName: true,
  personalEmail: true,
  phone: true,
  jobTitle: true,
  department: true,
  bio: true,
  avatarUrl: true,
  appearancePreference: true,
  customRoleId: true,
  customRole: {
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      permissions: true,
      isActive: true,
    },
  },
  createdAt: true,
  updatedAt: true,
};

const toSafeAuthErrorLog = (error) => ({
  message: String(error?.message || "Unknown auth error")
    .replace(/\s+/g, " ")
    .slice(0, 180),
  code: typeof error?.code === "string" ? error.code.slice(0, 40) : undefined,
});

const normalizeUsername = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_USERNAME_LEN) return null;
  if (!USERNAME_PATTERN.test(trimmed)) return null;
  return trimmed;
};

const normalizeRoleKey = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ROLE_KEY_PATTERN.test(normalized) ? normalized : "";
};

const normalizeRoleName = (value) => {
  const normalized = normalizeOptionalText(value, 80);
  if (!normalized) throw new Error("Role name is required");
  return normalized;
};

const normalizeRoleDescription = (value) => normalizeOptionalText(value, 240) || null;

const sanitizeCustomPermissions = (permissions = {}) => {
  const normalized = normalizeRolePermissions(permissions);
  normalized.team = PORTAL_ACTIONS.reduce((actions, action) => {
    actions[action] = false;
    return actions;
  }, {});
  normalized.profile.view = true;
  return normalized;
};

const buildSystemRoleDefinitions = () => [
  {
    id: "system-admin",
    key: "ADMIN",
    name: "Admin",
    description: "Developer-level access to every module and action.",
    permissions: getSystemRolePermissions("ADMIN"),
    isSystem: true,
    isActive: true,
  },
  {
    id: "system-owner",
    key: "OWNER",
    name: "Owner",
    description: "Business owner access to current operational modules and role setup.",
    permissions: getSystemRolePermissions("OWNER"),
    isSystem: true,
    isActive: true,
  },
  {
    id: "system-viewer",
    key: "VIEWER",
    name: "Viewer",
    description: "Read-only access to current modules, without team access.",
    permissions: getSystemRolePermissions("VIEWER"),
    isSystem: true,
    isActive: true,
  },
];

const resolveRoleAssignment = async (prisma, payload = {}) => {
  const rawRole = String(payload.role || payload.roleKey || "").trim();
  const normalizedSystemRole = rawRole.toUpperCase();
  if (SYSTEM_ROLES.has(normalizedSystemRole)) {
    return { role: normalizedSystemRole, customRoleId: null };
  }

  const customRoleRef = String(payload.customRoleId || payload.roleKey || payload.role || "").trim();
  if (!customRoleRef) {
    return { role: "VIEWER", customRoleId: null };
  }

  const customRole = await prisma.portalRole.findFirst({
    where: {
      isActive: true,
      OR: [
        { id: customRoleRef },
        { key: normalizeRoleKey(customRoleRef) || customRoleRef },
      ],
    },
    select: { id: true },
  });
  if (!customRole) {
    throw new Error("Selected role was not found.");
  }
  return { role: "CUSTOM", customRoleId: customRole.id };
};

const toRoleDefinition = (role) => ({
  id: role.id,
  key: role.key,
  name: role.name,
  description: role.description || "",
  permissions: role.isSystem ? role.permissions : sanitizeCustomPermissions(role.permissions),
  isSystem: Boolean(role.isSystem),
  isActive: role.isActive !== false,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

const normalizeOptionalText = (value, maxLength) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid profile field");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new Error(`Must be ${maxLength} characters or fewer`);
  return trimmed;
};

const normalizeOptionalEmail = (value) => {
  const normalized = normalizeOptionalText(value, PROFILE_FIELD_LIMITS.personalEmail);
  if (normalized === undefined || normalized === null) return normalized;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Personal email must be a valid email address");
  }
  return normalized.toLowerCase();
};

const normalizeOptionalPhone = (value) => {
  const normalized = normalizeOptionalText(value, PROFILE_FIELD_LIMITS.phone);
  if (normalized === undefined || normalized === null) return normalized;
  if (!/^\+?[0-9][0-9\s().-]{6,24}$/.test(normalized)) {
    throw new Error("Phone must be a valid phone number");
  }
  const digits = normalized.replace(/\D/g, "");
  if (!/^\d{7,15}$/.test(digits)) {
    throw new Error("Phone must be a valid phone number");
  }
  return normalized;
};

const normalizeAppearancePreference = (value) => {
  if (value === undefined) return undefined;
  const normalized = String(value || "").trim().toLowerCase();
  if (!APPEARANCE_PREFERENCES.has(normalized)) {
    throw new Error("Appearance must be system, light, or dark");
  }
  return normalized;
};

const normalizeAvatarUrl = (value) => {
  const normalized = normalizeOptionalText(value, MAX_AVATAR_URL_LEN);
  if (normalized === undefined || normalized === null) return normalized;
  const isRemoteImage = /^https?:\/\/[^\s]+$/i.test(normalized);
  const isDataImage = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=]+$/i.test(normalized);
  if (!isRemoteImage && !isDataImage) {
    throw new Error("Avatar must be an image URL or small uploaded image");
  }
  return normalized;
};

const normalizeOptionalNewPassword = (value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") throw new Error("New password must be 8-100 characters");
  if (value.length < MIN_PASSWORD_LEN || value.length > MAX_PASSWORD_LEN) {
    throw new Error("New password must be 8-100 characters");
  }
  return hashPassword(value);
};

const normalizeProfileUpdatePayload = (body = {}) => {
  const updates = {};

  if ("username" in body) {
    const username = normalizeUsername(body.username);
    if (!username) {
      throw new Error("Username must be 1-50 characters using letters, numbers, . _ - only");
    }
    updates.username = username;
  }

  for (const [field, maxLength] of Object.entries(PROFILE_FIELD_LIMITS)) {
    if (!(field in body)) continue;
    updates[field] =
      field === "personalEmail"
        ? normalizeOptionalEmail(body[field])
        : field === "phone"
        ? normalizeOptionalPhone(body[field])
        : normalizeOptionalText(body[field], maxLength);
  }

  if ("avatarUrl" in body) updates.avatarUrl = normalizeAvatarUrl(body.avatarUrl);
  if ("appearancePreference" in body) {
    updates.appearancePreference = normalizeAppearancePreference(body.appearancePreference);
  }
  if ("newPassword" in body) {
    const passwordHash = normalizeOptionalNewPassword(body.newPassword);
    if (passwordHash) updates.passwordHash = passwordHash;
  }

  return updates;
};

const getDisplayName = (user) => {
  const fullName = [user?.firstName, user?.lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
  return fullName || user?.username || "";
};

const toSessionUser = (user) => ({
  ...(() => {
    const access = resolveUserAccess(user);
    return {
      id: user.id,
      username: user.username,
      role: access.role,
      roleKey: access.roleKey,
      roleLabel: access.roleLabel,
      permissions: access.permissions,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      displayName: getDisplayName(user),
      personalEmail: user.personalEmail || "",
      phone: user.phone || "",
      jobTitle: user.jobTitle || "",
      department: user.department || "",
      bio: user.bio || "",
      avatarUrl: user.avatarUrl || "",
      appearancePreference: user.appearancePreference || "system",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  })(),
});

const requireAdmin = (prisma) => async (req, res, next) => {
  const token = getRequestAuthToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const payload = verifyToken(token);
  if (!payload?.id) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await prisma.siteUser.findUnique({
      where: { id: String(payload.id) },
      select: PROFILE_SELECT,
    });
    if (!user?.isActive) return res.status(401).json({ error: "Unauthorized" });
    if (!resolveUserAccess(user).isElevated) {
      return res.status(403).json({ error: "Owner or admin access required" });
    }
    req.authUser = user;
    return next();
  } catch (error) {
    console.error("Admin user lookup failed:", toSafeAuthErrorLog(error));
    return res.status(503).json({ error: "User profile is unavailable" });
  }
};

const requireCurrentUser = (prisma) => async (req, res, next) => {
  const token = getRequestAuthToken(req);
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const payload = verifyToken(token);
  if (!payload?.id) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = await prisma.siteUser.findUnique({
      where: { id: String(payload.id) },
      select: PROFILE_SELECT,
    });
    if (!user?.isActive) return res.status(401).json({ error: "Unauthorized" });
    req.authUser = user;
    return next();
  } catch (error) {
    console.error("Current user lookup failed:", toSafeAuthErrorLog(error));
    return res.status(503).json({ error: "User profile is unavailable" });
  }
};

export const createAuthRouter = (prisma) => {
  const router = Router();
  const requireSelf = requireCurrentUser(prisma);
  const requireRoleManager = requireAdmin(prisma);

  // POST /api/auth/login
  router.post("/login", async (req, res) => {
    const { username, password } = req.body || {};

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return res.status(400).json({ error: "Invalid username" });
    }
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ error: "Password is required" });
    }

    let user = null;
    try {
      user = await prisma.siteUser.findUnique({
        where: { username: normalizedUsername },
        select: { ...PROFILE_SELECT, passwordHash: true },
      });
    } catch (error) {
      console.error("Login DB error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Login failed" });
    }

    // Always run a hash comparison to prevent timing-based user enumeration
    const valid = safeVerifyPassword(password, user?.passwordHash ?? null);

    if (!user || !valid || !user.isActive) {
      return res.status(401).json({ error: "Incorrect username or password" });
    }

    let token;
    try {
      token = signToken({ id: user.id, username: user.username, role: user.role });
    } catch (error) {
      console.error("Admin token signing failed:", {
        message: error?.message || "Unknown token signing error",
      });
      return res.status(503).json({ error: "Admin authentication is not configured" });
    }

    setAdminAuthCookie(res, token);

    return res.json({ ok: true, ...toSessionUser(user) });
  });

  router.post("/logout", (_req, res) => {
    clearAdminAuthCookie(res);
    return res.json({ ok: true });
  });

  // GET /api/auth/me — current user's profile and preferences
  router.get("/me", requireSelf, async (req, res) => {
    return res.json({ ok: true, user: toSessionUser(req.authUser) });
  });

  // PATCH /api/auth/me — current user updates their profile and preferences
  router.patch("/me", requireSelf, async (req, res) => {
    let updates;
    try {
      updates = normalizeProfileUpdatePayload(req.body || {});
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid profile details" });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No profile fields to update" });
    }

    try {
      const updatedUser = await prisma.siteUser.update({
        where: { id: req.authUser.id },
        data: updates,
        select: PROFILE_SELECT,
      });
      const token = signToken({
        id: updatedUser.id,
        username: updatedUser.username,
        role: updatedUser.role,
      });
      setAdminAuthCookie(res, token);
      return res.json({ ok: true, ...toSessionUser(updatedUser) });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "That username is already taken" });
      }
      console.error("Update profile error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // POST /api/auth/users — admin creates a new user
  router.post("/users", requireRoleManager, async (req, res) => {
    const { username, password } = req.body || {};

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return res.status(400).json({
        error: "Username must be 1–50 characters (letters, numbers, . _ - only)",
      });
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
      return res.status(400).json({ error: "Password must be 8–100 characters" });
    }

    let roleAssignment;
    try {
      roleAssignment = await resolveRoleAssignment(prisma, req.body || {});
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid role" });
    }

    let passwordHash;
    try {
      passwordHash = hashPassword(password);
    } catch (error) {
      console.error("Hash error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to create user" });
    }

    try {
      const newUser = await prisma.siteUser.create({
        data: {
          username: normalizedUsername,
          passwordHash,
          role: roleAssignment.role,
          customRoleId: roleAssignment.customRoleId,
          createdById: req.authUser.id,
        },
        select: {
          id: true,
          username: true,
          role: true,
          customRoleId: true,
          customRole: { select: { id: true, key: true, name: true, permissions: true, isActive: true } },
          isActive: true,
          createdAt: true,
        },
      });

      return res.status(201).json({ ok: true, user: { ...newUser, ...resolveUserAccess(newUser) } });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "That username is already taken" });
      }
      console.error("Create user error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to create user" });
    }
  });

  // GET /api/auth/users — admin lists all users
  router.get("/users", requireRoleManager, async (req, res) => {
    try {
      const users = await prisma.siteUser.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          username: true,
          role: true,
          customRoleId: true,
          customRole: {
            select: {
              id: true,
              key: true,
              name: true,
              permissions: true,
              isActive: true,
            },
          },
          isActive: true,
          createdAt: true,
          createdBy: { select: { username: true } },
        },
      });

      return res.json({
        ok: true,
        users: users.map((user) => ({ ...user, ...resolveUserAccess(user) })),
      });
    } catch (error) {
      console.error("List users error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // PATCH /api/auth/users/:id — admin toggles active or changes role
  router.patch("/users/:id", requireRoleManager, async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body || {};

    if (id === req.authUser.id) {
      return res.status(400).json({ error: "You cannot modify your own account" });
    }

    const updates = {};
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if ("role" in req.body || "roleKey" in req.body || "customRoleId" in req.body) {
      try {
        const roleAssignment = await resolveRoleAssignment(prisma, req.body || {});
        updates.role = roleAssignment.role;
        updates.customRoleId = roleAssignment.customRoleId;
      } catch (error) {
        return res.status(400).json({ error: error.message || "Invalid role" });
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    try {
      const updated = await prisma.siteUser.update({
        where: { id },
        data: updates,
        select: {
          id: true,
          username: true,
          role: true,
          customRoleId: true,
          customRole: { select: { id: true, key: true, name: true, permissions: true, isActive: true } },
          isActive: true,
        },
      });

      return res.json({ ok: true, user: { ...updated, ...resolveUserAccess(updated) } });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
      console.error("Update user error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to update user" });
    }
  });

  router.get("/roles", requireRoleManager, async (_req, res) => {
    try {
      const customRoles = await prisma.portalRole.findMany({
        orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      });
      return res.json({
        ok: true,
        modules: PORTAL_MODULES,
        actions: PORTAL_ACTIONS,
        roles: [
          ...buildSystemRoleDefinitions(),
          ...customRoles.map(toRoleDefinition),
        ],
      });
    } catch (error) {
      console.error("List roles error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  router.post("/roles", requireRoleManager, async (req, res) => {
    let name;
    let description;
    let key;
    let permissions;
    try {
      name = normalizeRoleName(req.body?.name);
      description = normalizeRoleDescription(req.body?.description);
      key = normalizeRoleKey(req.body?.key) || normalizeRoleKey(name);
      if (!key || RESERVED_ROLE_KEYS.has(key) || RESERVED_ROLE_KEYS.has(key.toUpperCase())) {
        return res.status(400).json({ error: "Choose a unique custom role key." });
      }
      permissions = sanitizeCustomPermissions(req.body?.permissions || {});
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid role details" });
    }

    try {
      const created = await prisma.portalRole.create({
        data: {
          key,
          name,
          description,
          permissions,
          isSystem: false,
          isActive: true,
          createdById: req.authUser.id,
        },
      });
      return res.status(201).json({ ok: true, role: toRoleDefinition(created) });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "That role key already exists." });
      }
      console.error("Create role error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to create role" });
    }
  });

  router.patch("/roles/:id", requireRoleManager, async (req, res) => {
    const { id } = req.params;
    const updates = {};

    try {
      if ("name" in req.body) updates.name = normalizeRoleName(req.body?.name);
      if ("description" in req.body) updates.description = normalizeRoleDescription(req.body?.description);
      if ("permissions" in req.body) updates.permissions = sanitizeCustomPermissions(req.body?.permissions || {});
      if ("isActive" in req.body) {
        if (typeof req.body.isActive !== "boolean") {
          return res.status(400).json({ error: "Role status must be active or inactive." });
        }
        updates.isActive = req.body.isActive;
      }
    } catch (error) {
      return res.status(400).json({ error: error.message || "Invalid role details" });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid role fields to update" });
    }

    try {
      const existing = await prisma.portalRole.findUnique({
        where: { id },
        select: { id: true, isSystem: true },
      });
      if (!existing) return res.status(404).json({ error: "Role not found" });
      if (existing.isSystem) {
        return res.status(400).json({ error: "System roles cannot be edited." });
      }

      const updated = await prisma.portalRole.update({
        where: { id },
        data: updates,
      });
      return res.json({ ok: true, role: toRoleDefinition(updated) });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "Role not found" });
      }
      console.error("Update role error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to update role" });
    }
  });

  return router;
};
