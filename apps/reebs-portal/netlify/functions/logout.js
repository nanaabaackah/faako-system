/* eslint-disable no-undef */
import { createLogger } from "./_shared/logger.js";
import { resolvePgSslConfig } from "../../runtimeEnv.js";

const logger = createLogger("reebs:logout");
import { Client } from "pg";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { clearUserSessionCookie, getUserFromEvent } from "./_shared/userAuth.js";
import { ensureUserSessionsTable, revokeUserSession } from "./_shared/userSessions.js";

const respond = (event, statusCode, body = {}, extraHeaders = {}) =>
  json(event, statusCode, body, { methods: "POST, OPTIONS", extraHeaders });

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

  const payload = getUserFromEvent(event);
  const sessionTokenId =
    typeof payload?.sessionTokenId === "string" ? payload.sessionTokenId.trim() : "";

  if (!sessionTokenId) {
    return respond(event, 200, { revoked: false }, {
      "Set-Cookie": clearUserSessionCookie(event),
    });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureUserSessionsTable(client);
    const revoked = await revokeUserSession(client, sessionTokenId);
    if (revoked && payload?.userId) {
      writeAudit(client, {
        userId: Number(payload.userId) || null,
        organizationId: Number(payload.organizationId) || null,
        action: "LOGOUT",
        ipAddress: getClientIp(event),
      });
    }
    return respond(event, 200, { revoked }, {
      "Set-Cookie": clearUserSessionCookie(event),
    });
  } catch (error) {
    logger.error({ err: error }, "Logout error");
    return respond(event, 500, { error: "Failed to close session." });
  } finally {
    await client.end().catch(() => {});
  }
}
