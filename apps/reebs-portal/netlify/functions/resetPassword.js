/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { hashPassword } from "../../utils/passwords.js";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import {
  consumePasswordResetToken,
  ensurePasswordResetTokensTable,
} from "./_shared/passwordReset.js";
import {
  ensureUserSessionsTable,
  revokeUserSessionsForUser,
} from "./_shared/userSessions.js";

const MIN_PASSWORD_LENGTH = 8;

const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: "POST, OPTIONS" });

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204);
  }

  if (event.httpMethod !== "POST") {
    return respond(event, 405, { error: "Method not allowed." });
  }

  if (isCrossSiteBrowserRequest(event)) {
    return respond(event, 403, { error: "Cross-site requests are not allowed." });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return respond(event, 400, { error: "Invalid JSON body." });
  }

  const token = String(payload.token || "").trim();
  const password = String(payload.password || "").trim();

  if (!token) {
    return respond(event, 400, { error: "Reset token is required." });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return respond(event, 400, {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensurePasswordResetTokensTable(client);

    const resetRequest = await consumePasswordResetToken(client, token);
    if (!resetRequest) {
      return respond(event, 400, { error: "This reset link is invalid or has expired." });
    }

    const passwordHash = await hashPassword(password);
    const result = await client.query(
      `UPDATE "user"
       SET "password" = $1,
           "updatedAt" = NOW()
       WHERE id = $2
         AND "organizationId" = $3
       RETURNING id`,
      [
        passwordHash,
        Number(resetRequest.userId),
        Number(resetRequest.organizationId),
      ]
    );

    if (result.rowCount === 0) {
      return respond(event, 400, { error: "This reset link is invalid or has expired." });
    }

    await ensureUserSessionsTable(client);
    await revokeUserSessionsForUser(
      client,
      Number(resetRequest.userId),
      Number(resetRequest.organizationId)
    );

    return respond(event, 200, {
      message: "Your password has been reset. Sign in with your new password.",
    });
  } catch (error) {
    console.error("Password reset failed:", error);
    return respond(event, 500, { error: "Unable to reset password right now." });
  } finally {
    await client.end().catch(() => {});
  }
}
