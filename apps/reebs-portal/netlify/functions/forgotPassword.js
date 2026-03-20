/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { sendNotificationEmail } from "./_shared/email.js";
import { resolveOrganizationId } from "./_shared/organization.js";
import {
  cleanupPasswordResetTokens,
  createPasswordResetToken,
  ensurePasswordResetTokensTable,
  PASSWORD_RESET_TTL_MS,
} from "./_shared/passwordReset.js";
import {
  ensureUserPersonalEmailColumn,
  isValidPersonalEmail,
  normalizePersonalEmail,
} from "./_shared/userPersonalEmail.js";

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

const normalizePhoneVariants = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return [];
  const variants = new Set([digits]);
  if (digits.startsWith("233") && digits.length >= 12) {
    variants.add(`0${digits.slice(-9)}`);
  }
  if (digits.startsWith("0") && digits.length === 10) {
    variants.add(`233${digits.slice(1)}`);
  }
  return [...variants];
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
  const requestedPersonalEmail = normalizePersonalEmail(payload.personalEmail);
  const providedPhone = String(payload.phone || "").trim();
  if (!identifier) {
    return respond(event, 400, { error: "Personal email or username is required." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureUserPersonalEmailColumn(client);
    await ensurePasswordResetTokensTable(client);
    await cleanupPasswordResetTokens(client);
    const organizationId = await resolveOrganizationId(client, event, payload);

    const isUsernameOnly = !identifier.includes("@");
    const result = isUsernameOnly
      ? await client.query(
        `SELECT u.id, u."organizationId", u.email, u."personalEmail", u."fullName", p.phone
         FROM "user" u
         LEFT JOIN "employeeProfile" p ON p."userId" = u.id
         WHERE SPLIT_PART(LOWER(u.email), '@', 1) = $1
           AND u."organizationId" = $2
         LIMIT 1`,
        [identifier, organizationId]
      )
      : await client.query(
        `SELECT u.id, u."organizationId", u.email, u."personalEmail", u."fullName", p.phone
         FROM "user" u
         LEFT JOIN "employeeProfile" p ON p."userId" = u.id
         WHERE u."organizationId" = $2
           AND (LOWER(u.email) = $1 OR LOWER(u."personalEmail") = $1)
         LIMIT 1`,
        [identifier, organizationId]
      );

    const user = result.rows[0];
    if (user && isUsernameOnly && !user.personalEmail) {
      const storedPhoneVariants = normalizePhoneVariants(user.phone);
      if (!requestedPersonalEmail) {
        return respond(event, 200, {
          requiresPersonalEmailSetup: true,
          requiresPhoneVerification: storedPhoneVariants.length > 0,
          message: storedPhoneVariants.length > 0
            ? "This username does not have a personal email yet. Confirm your staff phone and set the personal email to send the reset link there."
            : "This username does not have a personal email or staff phone on file yet. Ask an administrator to update your profile before resetting your password.",
        });
      }

      if (!isValidPersonalEmail(requestedPersonalEmail)) {
        return respond(event, 400, { error: "Enter a valid personal email address." });
      }

      if (storedPhoneVariants.length === 0) {
        return respond(event, 409, {
          error: "No staff phone is on file for this account. Ask an administrator to update your profile first.",
        });
      }

      const providedPhoneVariants = normalizePhoneVariants(providedPhone);
      const hasMatchingPhone = providedPhoneVariants.some((variant) => storedPhoneVariants.includes(variant));
      if (!hasMatchingPhone) {
        return respond(event, 403, {
          error: "The phone number did not match our records for that username.",
        });
      }

      const duplicateEmail = await client.query(
        `SELECT id
         FROM "user"
         WHERE "organizationId" = $1
           AND LOWER("personalEmail") = $2
           AND id <> $3
         LIMIT 1`,
        [Number(user.organizationId), requestedPersonalEmail, Number(user.id)]
      );
      if (duplicateEmail.rowCount > 0) {
        return respond(event, 409, { error: "That personal email is already assigned to another user." });
      }

      await client.query(
        `UPDATE "user"
         SET "personalEmail" = $1,
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $3`,
        [requestedPersonalEmail, Number(user.id), Number(user.organizationId)]
      );
      user.personalEmail = requestedPersonalEmail;
    }

    if (user?.personalEmail) {
      try {
        const resetSession = await createPasswordResetToken(client, {
          organizationId: Number(user.organizationId),
          userId: Number(user.id),
          event,
        });
        const resetUrl = buildResetUrl(event, resetSession.token);
        await sendNotificationEmail({
          to: user.personalEmail,
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
        user?.personalEmail && requestedPersonalEmail
          ? `Personal email saved and verified. A reset link has been sent there and expires in ${Math.round(PASSWORD_RESET_TTL_MS / 60000)} minutes.`
          : `If an account matches that personal email or username, a reset link will be sent. `
            + `The link expires in ${Math.round(PASSWORD_RESET_TTL_MS / 60000)} minutes.`,
    });
  } catch (error) {
    console.error("Forgot password request failed:", error);
    return respond(event, 500, { error: "Unable to start password reset right now." });
  } finally {
    await client.end().catch(() => {});
  }
}
