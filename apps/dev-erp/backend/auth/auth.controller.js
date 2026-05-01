import { getRequestIp, writeAuditLog } from "../audit/audit.service.js";

const normalizeModuleName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const extractRoleModules = (role) => {
  const modules = role?.permissions?.modules;
  if (!Array.isArray(modules)) return [];
  return Array.from(
    new Set(
      modules
        .map((item) => normalizeModuleName(item))
        .filter(Boolean)
    )
  );
};

const hasOrganizationScope = (user) => {
  const organizationId = Number(user?.organizationId);
  return Number.isInteger(organizationId) && organizationId > 0;
};

const serializeSessionUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.firstName,
  lastName: user.lastName,
  fullName: user.fullName,
  role: {
    id: user.role.id,
    name: user.role.name,
    permissions: user.role.permissions ?? null,
  },
  organizationId: user.organizationId,
  allowedModules: extractRoleModules(user?.role),
});

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const createBuildToken = ({ jwt, jwtSecret }) => (user) => {
  const payload = {
    purpose: "session",
    userId: user.id,
    tokenVersion: user.tokenVersion ?? 0,
  };
  return jwt.sign(payload, jwtSecret, { expiresIn: ACCESS_TOKEN_TTL });
};

export const createIssueRefreshToken = ({ crypto, prisma }) => async (userId) => {
  const raw = crypto.randomBytes(40).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return raw;
};

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export const createLoginHandler =
  ({ prisma, bcrypt, buildToken, createCsrfToken, setAuthCookies, issueRefreshToken, setRefreshCookie }) =>
  async (req, res) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    const password = (req.body?.password || "").trim();
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        error: "Your account is not active yet. Check your invitation email to set up your account.",
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const retryAfterSec = Math.ceil((user.lockedUntil - Date.now()) / 1000);
      return res
        .status(429)
        .set("Retry-After", String(retryAfterSec))
        .json({ error: "Too many failed login attempts. Try again later." });
    }

    if (!user.role) {
      console.error("Login blocked: user is missing a role assignment.", {
        userId: user.id,
        email,
      });
      return res.status(503).json({
        error: "Your account is not configured correctly. Contact an administrator.",
      });
    }
    if (!hasOrganizationScope(user)) {
      console.error("Login blocked: user is missing an organization assignment.", {
        userId: user.id,
        email,
      });
      return res.status(503).json({
        error: "Your account is not configured correctly. Contact an administrator.",
      });
    }

    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, user.password);
    } catch (error) {
      console.error("Login password verification failed.", {
        userId: user.id,
        email,
        error: error?.message || error,
      });
      return res.status(503).json({
        error: "Your account is not configured correctly. Contact an administrator.",
      });
    }

    if (!isValid) {
      const newAttempts = user.loginAttempts + 1;
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      writeAuditLog(prisma, {
        userId: user.id,
        organizationId: user.organizationId ?? null,
        action: "LOGIN_FAILED",
        source: "auth",
        category: "access",
        severity: shouldLock ? "warning" : "info",
        status: "failed",
        summary: shouldLock
          ? "Login failed and the account was temporarily locked."
          : "Login failed.",
        actorLabel: user.fullName || user.email,
        metadata: { attempts: newAttempts, locked: shouldLock },
        ipAddress: getRequestIp(req),
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionToken = buildToken(user);
    const csrfToken = createCsrfToken();
    setAuthCookies(res, { token: sessionToken, csrfToken });

    await prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    if (typeof issueRefreshToken === "function" && typeof setRefreshCookie === "function") {
      const rawRefresh = await issueRefreshToken(user.id);
      setRefreshCookie(res, rawRefresh);
    }

    writeAuditLog(prisma, {
      userId: user.id,
      organizationId: user.organizationId ?? null,
      action: "LOGIN_SUCCESS",
      source: "auth",
      category: "access",
      severity: "info",
      status: "ok",
      summary: "User logged in successfully.",
      actorLabel: user.fullName || user.email,
      ipAddress: getRequestIp(req),
    });

    return res.json({
      user: serializeSessionUser(user),
    });
  };

export const createGetSessionHandler =
  ({ prisma }) =>
  async (req, res) => {
    const userId = Number(req.user?.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: "Invalid or expired authentication session" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user || user.status !== "ACTIVE" || !user.role || !hasOrganizationScope(user)) {
      return res.status(401).json({ error: "Invalid or expired authentication session" });
    }

    return res.json({
      user: serializeSessionUser(user),
    });
  };

export const createLogoutHandler =
  ({ clearAuthCookies, clearRefreshCookie, prisma, verifyTokenPayload, getCookieValue, authCookieName, refreshCookieName, readBearerToken, crypto }) =>
  async (req, res) => {
    try {
      const token =
        readBearerToken(req.headers.authorization) ||
        getCookieValue(req, authCookieName);
      const payload = token ? verifyTokenPayload(token) : null;
      const userId = Number(payload?.userId);
      if (Number.isInteger(userId) && userId > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: { tokenVersion: { increment: 1 } },
        });
        const rawRefresh = getCookieValue(req, refreshCookieName);
        if (rawRefresh && crypto) {
          const tokenHash = crypto.createHash("sha256").update(rawRefresh).digest("hex");
          await prisma.refreshToken.updateMany({
            where: { userId, tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
          }).catch(() => {});
        }
        writeAuditLog(prisma, {
          userId,
          action: "LOGOUT",
          source: "auth",
          category: "access",
          severity: "info",
          status: "ok",
          summary: "User logged out.",
          ipAddress: getRequestIp(req),
        });
      }
    } catch {
      // Non-fatal: always clear cookies regardless
    }
    clearAuthCookies(res);
    if (typeof clearRefreshCookie === "function") clearRefreshCookie(res);
    return res.json({ ok: true });
  };

export const createRefreshHandler =
  ({ prisma, crypto, buildToken, setAuthCookies, createCsrfToken, issueRefreshToken, setRefreshCookie, getCookieValue, refreshCookieName }) =>
  async (req, res) => {
    const rawToken = getCookieValue(req, refreshCookieName);
    if (!rawToken) {
      return res.status(401).json({ error: "No refresh token provided." });
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid or expired refresh token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId },
      include: { role: true },
    });
    if (!user || user.status !== "ACTIVE" || !user.role) {
      return res.status(401).json({ error: "Invalid or expired refresh token." });
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const newRaw = await issueRefreshToken(user.id);
    setRefreshCookie(res, newRaw);

    const accessToken = buildToken(user);
    const csrfToken = createCsrfToken();
    setAuthCookies(res, { token: accessToken, csrfToken });

    return res.json({ ok: true });
  };

export const createForgotPasswordHandler =
  ({ defaultAdminEmail, prisma, sendForgotPasswordEmail }) =>
  async (req, res) => {
    const email = (req.body?.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: "Email is required to recover your login." });
    }

    console.info(`Password reset requested for ${email}`);
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user && user.status !== "SUSPENDED" && typeof sendForgotPasswordEmail === "function") {
      try {
        await sendForgotPasswordEmail({ req, user });
      } catch (error) {
        console.error(`Failed to send password reset email for ${email}`, error);
      }
    }

    return res.json({
      message: "If that address exists in our system, we will email you instructions shortly.",
      supportEmail: defaultAdminEmail,
    });
  };

export const createSetupAccountVerifyHandler =
  ({ verifySetupTokenPayload, prisma }) =>
  async (req, res) => {
    const token = String(req.body?.token || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Invitation token is required." });
    }

    const payload = verifySetupTokenPayload(token);
    if (!payload) {
      return res.status(400).json({ error: "Invalid or expired invitation token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });
    if (!user) {
      return res.status(404).json({ error: "Invitation account was not found." });
    }

    if (
      String(user.email || "").trim().toLowerCase() !== payload.email ||
      user.updatedAt.toISOString() !== payload.version
    ) {
      return res.status(400).json({ error: "This invitation is no longer valid." });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "This account is suspended. Contact an administrator." });
    }

    return res.json({
      ok: true,
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: { id: user.role.id, name: user.role.name },
      },
    });
  };

export const createSetupAccountCompleteHandler =
  ({ verifySetupTokenPayload, validatePasswordStrength, passwordPolicyHint, prisma, bcrypt }) =>
  async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "").trim();
    if (!token) {
      return res.status(400).json({ error: "Invitation token is required." });
    }
    if (!password) {
      return res.status(400).json({ error: "password is required." });
    }

    const payload = verifySetupTokenPayload(token);
    if (!payload) {
      return res.status(400).json({ error: "Invalid or expired invitation token." });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      return res.status(404).json({ error: "Invitation account was not found." });
    }
    if (
      String(user.email || "").trim().toLowerCase() !== payload.email ||
      user.updatedAt.toISOString() !== payload.version
    ) {
      return res.status(400).json({ error: "This invitation is no longer valid." });
    }
    if (user.status === "SUSPENDED") {
      return res.status(403).json({ error: "This account is suspended. Contact an administrator." });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.ok) {
      return res.status(400).json({
        error: passwordValidation.error,
        passwordPolicy: passwordPolicyHint,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        status: user.status === "PENDING" ? "ACTIVE" : user.status,
      },
    });

    writeAuditLog(prisma, {
      userId: user.id,
      organizationId: user.organizationId ?? null,
      action: "ACCOUNT_SETUP",
      source: "auth",
      category: "access",
      severity: "info",
      status: "ok",
      summary: "Account setup completed.",
      actorLabel: user.fullName || user.email,
      ipAddress: getRequestIp(req),
    });

    return res.json({
      ok: true,
      message: "Account setup complete. You can now sign in.",
    });
  };
