/* eslint-disable no-undef */
import { createLogger } from "./_shared/logger.js";
import { resolvePgSslConfig } from "../../runtimeEnv.js";

const logger = createLogger("reebs:login");
import { Client } from "pg";
import { hashPassword, verifyPassword } from "../../utils/passwords.js";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { buildUserSessionCookie, signUserToken } from "./_shared/userAuth.js";
import { ensureUserPersonalEmailColumn } from "./_shared/userPersonalEmail.js";
import {
  createUserSession,
  ensureUserSessionsTable,
  USER_SESSION_TTL_MS,
} from "./_shared/userSessions.js";
const SESSION_ONLY_TTL_MS = 1000 * 60 * 60 * 12;

const getClientIp = (event) =>
  String(event.headers?.["x-forwarded-for"] || event.headers?.["x-real-ip"] || "")
    .split(",")[0]
    .trim() || null;

const writeAudit = (client, data) => {
  client
    .query(
      `INSERT INTO "auditLog" ("organizationId","userId","action","metadata","ipAddress","createdAt")
       VALUES ($1,$2,$3,$4,$5,NOW())`,
      [data.organizationId ?? null, data.userId ?? null, data.action, data.metadata ? JSON.stringify(data.metadata) : null, data.ipAddress ?? null]
    )
    .catch(() => {});
};

const respond = (event, statusCode, payload = {}, extraHeaders = {}) =>
  json(event, statusCode, payload, { methods: "POST, OPTIONS", extraHeaders });

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204);
  }

  if (event.httpMethod !== "POST") {
    return respond(event, 405, { error: "Method not allowed" });
  }

  if (isCrossSiteBrowserRequest(event)) {
    return respond(event, 403, { error: "Cross-site requests are not allowed." });
  }

  const { email, password, remember } = (() => {
    try {
      return JSON.parse(event.body || "{}");
    } catch {
      return {};
    }
  })();

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPassword = typeof password === "string" ? password.trim() : "";
  const isUsernameOnly = normalizedEmail && !normalizedEmail.includes("@");
  const rememberSession = remember !== false;
  const sessionTtlMs = rememberSession ? USER_SESSION_TTL_MS : SESSION_ONLY_TTL_MS;

  if (!normalizedEmail || !normalizedPassword) {
    return respond(event, 400, { error: "Email/username and password are required." });
  }
  if (normalizedEmail.length > 254 || normalizedPassword.length > 1024) {
    return respond(event, 400, { error: "Invalid credentials." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureUserPersonalEmailColumn(client);
    const result = isUsernameOnly
      ? await client.query(
        `SELECT id, "firstName", "lastName", "fullName", email, "personalEmail", role, "organizationId", password, "loginAttempts", "lockedUntil"
         FROM "user"
         WHERE SPLIT_PART(LOWER(email), '@', 1) = $1
         LIMIT 1`,
        [normalizedEmail]
      )
      : await client.query(
        `SELECT id, "firstName", "lastName", "fullName", email, "personalEmail", role, "organizationId", password, "loginAttempts", "lockedUntil"
         FROM "user"
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [normalizedEmail]
      );

    const user = result.rows[0];
    if (!user) {
      return respond(event, 401, { error: "Invalid credentials." });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const retryAfterSec = Math.ceil((new Date(user.lockedUntil) - Date.now()) / 1000);
      return respond(event, 429, { error: "Too many failed login attempts. Try again later." }, {
        "Retry-After": String(retryAfterSec),
      });
    }

    const { isValid, needsRehash } = await verifyPassword(normalizedPassword, user.password);
    if (!isValid) {
      const maxAttempts = 5;
      const lockoutMs = 15 * 60 * 1000;
      const newAttempts = (user.loginAttempts || 0) + 1;
      const shouldLock = newAttempts >= maxAttempts;
      await client.query(
        `UPDATE "user" SET "loginAttempts" = $1, "lockedUntil" = $2 WHERE id = $3`,
        [newAttempts, shouldLock ? new Date(Date.now() + lockoutMs) : null, user.id]
      );
      writeAudit(client, {
        userId: user.id,
        organizationId: user.organizationId ?? null,
        action: "LOGIN_FAILED",
        metadata: { attempts: newAttempts, locked: shouldLock },
        ipAddress: getClientIp(event),
      });
      return respond(event, 401, { error: "Invalid credentials." });
    }

    if (needsRehash) {
      try {
        const newHash = await hashPassword(normalizedPassword);
        await client.query(
          `UPDATE "user" SET "password" = $1, "updatedAt" = NOW() WHERE id = $2`,
          [newHash, user.id]
        );
      } catch (err) {
        logger.warn({ userId: user.id, err }, "Password rehash failed");
      }
    }

    if (user.loginAttempts > 0 || user.lockedUntil) {
      await client.query(
        `UPDATE "user" SET "loginAttempts" = 0, "lockedUntil" = NULL WHERE id = $1`,
        [user.id]
      );
    }

    // Strip password and lockout fields before returning
    const { password: _, loginAttempts: __, lockedUntil: ___, ...safeUser } = user;
    await ensureUserSessionsTable(client);
    const session = await createUserSession(client, {
      organizationId: user.organizationId,
      userId: user.id,
      event,
      remember: rememberSession,
      ttlMs: sessionTtlMs,
    });
    const token = signUserToken({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      sessionTokenId: session.sessionTokenId,
    }, sessionTtlMs);
    if (!token) {
      return respond(event, 500, { error: "Auth secret is not configured." });
    }

    writeAudit(client, {
      userId: user.id,
      organizationId: user.organizationId ?? null,
      action: "LOGIN_SUCCESS",
      ipAddress: getClientIp(event),
    });

    const sessionCookie = buildUserSessionCookie(event, token, { ttlMs: sessionTtlMs });
    return respond(event, 200, {
      ...safeUser,
      authenticatedAt: session.createdAt,
      sessionCreatedAt: session.createdAt,
      sessionLastSeenAt: session.lastSeenAt,
      token,
      expiresInHours: Math.round(sessionTtlMs / (1000 * 60 * 60)),
    }, {
      "Set-Cookie": sessionCookie,
    });
  } catch (err) {
    logger.error({ err }, "Login error");
    return respond(event, 500, { error: "Login failed. Please try again." });
  } finally {
    await client.end().catch(() => {});
  }
}
