/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { sendNotificationEmail } from "./_shared/email.js";
import {
  cleanupPasswordResetTokens,
  createPasswordResetToken,
  ensurePasswordResetTokensTable,
  PASSWORD_RESET_TTL_MS,
} from "./_shared/passwordReset.js";

const DEFAULT_RESET_BASE_URL = "https://portal.reebspartythemes.com";

const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: "POST, OPTIONS" });

const normalizeBaseUrl = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed).origin;
  } catch {
    return "";
  }
};

const resolveResetBaseUrl = (event) => {
  const candidates = [
    event?.headers?.origin,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
    DEFAULT_RESET_BASE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  return DEFAULT_RESET_BASE_URL;
};

const buildResetUrl = (event, token) => {
  const baseUrl = resolveResetBaseUrl(event);
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
};

const buildResetEmailText = ({ resetUrl, expiresAt }) => {
  const expiresAtLabel = new Date(expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return [
    "A password reset was requested for your REEBS staff account.",
    "",
    "Use the secure link below to choose a new password:",
    resetUrl,
    "",
    `This link expires on ${expiresAtLabel}.`,
    "If you did not request this, you can safely ignore this email.",
  ].join("\n");
};

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

  const identifier = String(payload.identifier || payload.email || "").trim().toLowerCase();
  if (!identifier) {
    return respond(event, 400, { error: "Email or username is required." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensurePasswordResetTokensTable(client);
    await cleanupPasswordResetTokens(client);

    const isUsernameOnly = !identifier.includes("@");
    const result = isUsernameOnly
      ? await client.query(
        `SELECT id, "organizationId", email, "fullName"
         FROM "user"
         WHERE SPLIT_PART(LOWER(email), '@', 1) = $1
         LIMIT 1`,
        [identifier]
      )
      : await client.query(
        `SELECT id, "organizationId", email, "fullName"
         FROM "user"
         WHERE LOWER(email) = $1
         LIMIT 1`,
        [identifier]
      );

    const user = result.rows[0];
    if (user?.email) {
      try {
        const resetSession = await createPasswordResetToken(client, {
          organizationId: Number(user.organizationId),
          userId: Number(user.id),
          event,
        });
        const resetUrl = buildResetUrl(event, resetSession.token);
        await sendNotificationEmail({
          to: user.email,
          subject: "REEBS password reset request",
          text: buildResetEmailText({
            resetUrl,
            expiresAt: resetSession.expiresAt,
          }),
        });
      } catch (error) {
        console.error("Forgot password email failed:", error);
      }
    }

    return respond(event, 200, {
      message:
        `If an account matches that email or username, a reset link will be sent. `
        + `The link expires in ${Math.round(PASSWORD_RESET_TTL_MS / 60000)} minutes.`,
    });
  } catch (error) {
    console.error("Forgot password request failed:", error);
    return respond(event, 500, { error: "Unable to start password reset right now." });
  } finally {
    await client.end().catch(() => {});
  }
}
