/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { getUserFromEvent } from "./_shared/userAuth.js";
import { ensureUserSessionsTable, revokeUserSession } from "./_shared/userSessions.js";

const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: "POST, OPTIONS" });

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
    return respond(event, 200, { revoked: false });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureUserSessionsTable(client);
    const revoked = await revokeUserSession(client, sessionTokenId);
    return respond(event, 200, { revoked });
  } catch (error) {
    console.error("Logout error", error);
    return respond(event, 500, { error: "Failed to close session." });
  } finally {
    await client.end().catch(() => {});
  }
}
