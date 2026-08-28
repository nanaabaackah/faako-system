/* eslint-disable no-undef */
import { createLogger } from "./_shared/logger.js";
import { APP_ENV, resolvePgSslConfig } from "../../runtimeEnv.js";

const logger = createLogger("reebs:forgot-password");
import { Pool } from "pg";
import emailKit from "../../../../packages/email-kit/src/index.cjs";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import {
  getForcedEmailRecipient,
  getNotificationCatchallEmail,
  sendNotificationEmail,
} from "./_shared/email.js";
import { resolveConfiguredPublicOrganizationId } from "./_shared/organization.js";
import {
  createPasswordResetToken,
  ensurePasswordResetTokensTable,
  maybeCleanupPasswordResetTokens,
  PASSWORD_RESET_TTL_MS,
} from "./_shared/passwordReset.js";
import {
  applyWindowRateLimit,
  getRequestClientIp,
} from "./_shared/requestRateLimit.js";
import {
  ensureUserPersonalEmailColumn,
  isValidPersonalEmail,
  normalizePersonalEmail,
} from "./_shared/userPersonalEmail.js";

const {
  EMAIL_THEMES,
  renderButton,
  renderEmailLayout,
  renderKeyValueTable,
  renderNotice,
  renderPanel,
  renderParagraphs,
} = emailKit;

const DEFAULT_RESET_BASE_URL = "https://portal.reebspartythemes.com";
const SYSTEM_ADMIN_EMAIL = "system_admin@reebs.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORGOT_PASSWORD_POOL_KEY = "__reebsForgotPasswordPool";
const REEBS_THEME = EMAIL_THEMES.reebs;

const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: "POST, OPTIONS" });

const getForgotPasswordPool = () => {
  if (!globalThis[FORGOT_PASSWORD_POOL_KEY]) {
    globalThis[FORGOT_PASSWORD_POOL_KEY] = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: resolvePgSslConfig(),
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }

  return globalThis[FORGOT_PASSWORD_POOL_KEY];
};

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

const buildResetEmailHtml = ({ recipientName, resetUrl, expiresAt }) => {
  const safeRecipient = String(recipientName || "").trim() || "there";
  const expiresAtLabel = new Date(expiresAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const introHtml = [
    renderParagraphs(
      [
        `Hello ${safeRecipient},`,
        "We received a request to reset the password for your REEBS staff portal account. Use the secure link below to choose a new password.",
      ],
      { theme: REEBS_THEME }
    ),
    `<div style="margin:0 0 18px;">${renderButton({
      href: resetUrl,
      label: "Reset password",
      theme: REEBS_THEME,
    })}</div>`,
  ].join("");

  const bodyHtml = [
    renderPanel({
      theme: REEBS_THEME,
      eyebrow: "Password reset",
      title: "Reset details",
      bodyHtml: renderKeyValueTable(
        [
          ["Workspace", "REEBS staff portal"],
          ["Recipient", safeRecipient],
          ["Link expires", expiresAtLabel],
        ],
        { theme: REEBS_THEME }
      ),
    }),
    renderNotice({
      theme: REEBS_THEME,
      title: "Manual link",
      lines: [
        "If the button does not open, copy and paste this reset link into your browser:",
        resetUrl,
      ],
    }),
    renderPanel({
      theme: REEBS_THEME,
      title: "Security note",
      bodyHtml: renderParagraphs(
        "If you did not request this password reset, you can safely ignore this email.",
        { theme: REEBS_THEME, color: REEBS_THEME.muted, spacing: "0" }
      ),
    }),
  ].join("");

  return renderEmailLayout({
    theme: REEBS_THEME,
    preheader: `Reset your REEBS password. This link expires on ${expiresAtLabel}.`,
    brandName: "REEBS Party Themes",
    brandTagline: "Staff portal access",
    eyebrow: "Password reset",
    title: "Reset your password",
    subtitle: "Use the secure link below to create a new password for your staff account.",
    introHtml,
    bodyHtml,
    footerHtml: `<p style="margin:6px 0 0;color:${REEBS_THEME.muted};font:400 13px/1.65 Arial,sans-serif;">Sent by the REEBS staff portal.</p>`,
  });
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

const isDeliverableEmail = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) && !normalized.endsWith("@reebs.com");
};

const getForcedLocalEmailRecipient = () => {
  const configured = String(getForcedEmailRecipient() || "").trim().toLowerCase();
  return isDeliverableEmail(configured) ? configured : "";
};

const getDefaultAdminEmail = () => {
  const configured = String(process.env.DEFAULT_ADMIN_EMAIL || "").trim().toLowerCase();
  return isDeliverableEmail(configured) ? configured : "";
};

const resolveLocalResetDeliveryRecipient = async (client, organizationId) => {
  const forcedRecipient = getForcedLocalEmailRecipient();
  if (forcedRecipient) {
    return forcedRecipient;
  }

  const configuredAdminEmail = getDefaultAdminEmail();
  if (configuredAdminEmail) {
    return configuredAdminEmail;
  }

  const adminResult = await client.query(
    `SELECT "personalEmail", email
     FROM "user"
     WHERE "organizationId" = $1
       AND LOWER(role) = 'admin'
     ORDER BY CASE WHEN LOWER(email) = $2 THEN 0 ELSE 1 END, id ASC
     LIMIT 5`,
    [organizationId, SYSTEM_ADMIN_EMAIL]
  );

  for (const adminUser of adminResult.rows) {
    if (isDeliverableEmail(adminUser?.personalEmail)) {
      return String(adminUser.personalEmail).trim().toLowerCase();
    }
  }

  const catchallEmail = String(getNotificationCatchallEmail() || "").trim().toLowerCase();
  if (isDeliverableEmail(catchallEmail)) {
    return catchallEmail;
  }

  return "";
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

  const pool = getForgotPasswordPool();
  let client;

  try {
    client = await pool.connect();
    await Promise.all([
      ensureUserPersonalEmailColumn(client),
      ensurePasswordResetTokensTable(client),
    ]);
    await maybeCleanupPasswordResetTokens(client).catch((error) => {
      logger.warn({ err: error }, "Password reset token cleanup skipped");
    });
    // Intentionally public: password reset requests are limited to the configured public organization.
    const organizationId = await resolveConfiguredPublicOrganizationId(client);
    const limitResult = await applyWindowRateLimit(client, {
      scope: `forgot-password:${organizationId}:ip`,
      identifier: getRequestClientIp(event),
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limitResult.allowed) {
      return respond(event, 429, {
        error: "Too many reset attempts. Try again later.",
        retryAfterSeconds: limitResult.retryAfterSeconds,
      });
    }

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

    const localResetRecipient =
      user?.personalEmail && APP_ENV !== "production"
        ? await resolveLocalResetDeliveryRecipient(client, Number(user.organizationId))
        : "";

    if (user?.personalEmail) {
      try {
        const resetSession = await createPasswordResetToken(client, {
          organizationId: Number(user.organizationId),
          userId: Number(user.id),
          event,
        });
        const resetUrl = buildResetUrl(event, resetSession.token);
        const emailRecipient = localResetRecipient || user.personalEmail;
        const wasLocalResetRerouted =
          Boolean(localResetRecipient)
          && localResetRecipient.toLowerCase() !== String(user.personalEmail).trim().toLowerCase();
        await sendNotificationEmail({
          to: emailRecipient,
          subject: "REEBS password reset request",
          text: [
            wasLocalResetRerouted
              ? [
                  "This reset email was rerouted to the default admin inbox for local development.",
                  `Requested personal inbox: ${user.personalEmail}`,
                  `Delivered to: ${emailRecipient}`,
                  "",
                ].join("\n")
              : "",
            buildResetEmailText({
              resetUrl,
              expiresAt: resetSession.expiresAt,
            }),
          ]
            .filter(Boolean)
            .join("\n"),
          html: [
            wasLocalResetRerouted
              ? renderNotice({
                  theme: REEBS_THEME,
                  title: "Local development delivery",
                  tone: "warning",
                  lines: [
                    `Requested personal inbox: ${user.personalEmail}`,
                    `Delivered to: ${emailRecipient}`,
                  ],
                })
              : "",
            buildResetEmailHtml({
              recipientName: user.fullName,
              resetUrl,
              expiresAt: resetSession.expiresAt,
            }),
          ]
            .filter(Boolean)
            .join(""),
        });
      } catch (error) {
        logger.error({ err: error }, "Forgot password email failed");
      }
    }

    const localResetMessage =
      localResetRecipient
        ? " In local development, matching reset links are delivered to the configured local inbox."
        : "";

    return respond(event, 200, {
      message:
        user?.personalEmail && requestedPersonalEmail
          ? `Personal email saved and verified. A reset link has been sent and expires in ${Math.round(PASSWORD_RESET_TTL_MS / 60000)} minutes.${localResetMessage}`
          : `If an account matches that personal email or username, a reset link will be sent. `
            + `The link expires in ${Math.round(PASSWORD_RESET_TTL_MS / 60000)} minutes.${localResetMessage}`,
    });
  } catch (error) {
    logger.error({ err: error }, "Forgot password request failed");
    return respond(event, 500, { error: "Unable to start password reset right now." });
  } finally {
    client?.release();
  }
}
