import { Router } from "express";
import { hashPassword, signToken, verifyToken, safeVerifyPassword } from "../auth.js";

const MAX_USERNAME_LEN = 50;
const MAX_PASSWORD_LEN = 100;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

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

const requireAdmin = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const payload = verifyToken(token);
  if (!payload || payload.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }

  req.authUser = payload;
  return next();
};

export const createAuthRouter = (prisma) => {
  const router = Router();

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
        select: { id: true, username: true, role: true, passwordHash: true, isActive: true },
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

    return res.json({ ok: true, token, username: user.username, role: user.role });
  });

  // POST /api/auth/users — admin creates a new user
  router.post("/users", requireAdmin, async (req, res) => {
    const { username, password, role } = req.body || {};

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      return res.status(400).json({
        error: "Username must be 1–50 characters (letters, numbers, . _ - only)",
      });
    }

    if (typeof password !== "string" || password.length < 8 || password.length > MAX_PASSWORD_LEN) {
      return res.status(400).json({ error: "Password must be 8–100 characters" });
    }

    const normalizedRole = role === "ADMIN" ? "ADMIN" : "VIEWER";

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
          role: normalizedRole,
          createdById: req.authUser.id,
        },
        select: { id: true, username: true, role: true, isActive: true, createdAt: true },
      });

      return res.status(201).json({ ok: true, user: newUser });
    } catch (error) {
      if (error.code === "P2002") {
        return res.status(409).json({ error: "That username is already taken" });
      }
      console.error("Create user error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to create user" });
    }
  });

  // GET /api/auth/users — admin lists all users
  router.get("/users", requireAdmin, async (req, res) => {
    try {
      const users = await prisma.siteUser.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          createdBy: { select: { username: true } },
        },
      });

      return res.json({ ok: true, users });
    } catch (error) {
      console.error("List users error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // PATCH /api/auth/users/:id — admin toggles active or changes role
  router.patch("/users/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { isActive, role } = req.body || {};

    if (id === req.authUser.id) {
      return res.status(400).json({ error: "You cannot modify your own account" });
    }

    const updates = {};
    if (typeof isActive === "boolean") updates.isActive = isActive;
    if (role === "ADMIN" || role === "VIEWER") updates.role = role;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    try {
      const updated = await prisma.siteUser.update({
        where: { id },
        data: updates,
        select: { id: true, username: true, role: true, isActive: true },
      });

      return res.json({ ok: true, user: updated });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({ error: "User not found" });
      }
      console.error("Update user error:", toSafeAuthErrorLog(error));
      return res.status(500).json({ error: "Failed to update user" });
    }
  });

  return router;
};
