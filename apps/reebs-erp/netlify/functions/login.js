/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { hashPassword, verifyPassword } from "../../utils/passwords.js";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { signUserToken } from "./_shared/userAuth.js";
import {
  createUserSession,
  ensureUserSessionsTable,
  USER_SESSION_TTL_MS,
} from "./_shared/userSessions.js";
const SESSION_ONLY_TTL_MS = 1000 * 60 * 60 * 12;

const respond = (event, statusCode, payload = {}) =>
  json(event, statusCode, payload, { methods: "POST, OPTIONS" });

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

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const result = isUsernameOnly
      ? await client.query(
        `SELECT id, "firstName", "lastName", "fullName", email, role, "organizationId", password
         FROM "user"
         WHERE SPLIT_PART(LOWER(email), '@', 1) = $1
         LIMIT 1`,
        [normalizedEmail]
      )
      : await client.query(
        `SELECT id, "firstName", "lastName", "fullName", email, role, "organizationId", password
         FROM "user"
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [normalizedEmail]
      );

    const user = result.rows[0];
    if (!user) {
      return respond(event, 401, { error: "Invalid credentials." });
    }

    const { isValid, needsRehash } = await verifyPassword(normalizedPassword, user.password);
    if (!isValid) {
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
        console.warn("Password rehash failed for user", user.id, err);
      }
    }

    // Strip password before returning
    const { password: _, ...safeUser } = user;
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

    return respond(event, 200, {
      ...safeUser,
      token,
      expiresInHours: Math.round(sessionTtlMs / (1000 * 60 * 60)),
    });
  } catch (err) {
    console.error("Login error", err);
    return respond(event, 500, { error: "Login failed. Please try again." });
  } finally {
    await client.end().catch(() => {});
  }
}
