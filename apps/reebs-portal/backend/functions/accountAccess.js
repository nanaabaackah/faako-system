/* eslint-disable no-undef */
import crypto from "node:crypto";
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { hashPassword } from "../../utils/passwords.js";
import {
  SYSTEM_ADMIN_EMAIL,
} from "./_shared/accessControl.js";
import { writeAuditLog, getEventIpAddress, getEventHeader } from "./_shared/auditLog.js";
import {
  isTrustedBrowserMutation,
  json,
} from "./_shared/http.js";
import { createLogger } from "./_shared/logger.js";
import { resolveConfiguredPublicOrganizationId } from "./_shared/organization.js";
import { applyWindowRateLimit, getRequestClientIp } from "./_shared/requestRateLimit.js";
import { requireUser } from "./_shared/userAuth.js";
import { isValidPersonalEmail, normalizePersonalEmail } from "./_shared/userPersonalEmail.js";
import {
  buildEmailFromNames,
  buildFullName,
  canAccessUsersMethod,
  canAssignUserRole,
  cleanNamePart,
  formatStoredRole,
  normalizeRoleKey,
  VALID_USER_ROLE_KEYS,
} from "./users.js";

const logger = createLogger("account-access");
const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;
const respond = (event, statusCode, payload = {}) =>
  json(event, statusCode, payload, { methods: "GET,POST,OPTIONS" });

const digest = (value) =>
  crypto.createHash("sha256").update(String(value || ""), "utf8").digest();
export const accountAccessSecretsMatch = (left, right) => {
  const leftDigest = digest(left);
  const rightDigest = digest(right);
  return Boolean(String(left || "").trim())
    && Boolean(String(right || "").trim())
    && crypto.timingSafeEqual(leftDigest, rightDigest);
};
export const hashAccountAccessToken = (token) => digest(token).toString("hex");
const parseBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};
const requestPath = (event) => {
  try {
    return new URL(event.rawUrl || "http://localhost/").pathname;
  } catch {
    return "";
  }
};
const bootstrapConfigured = () =>
  String(process.env.REEBS_ADMIN_BOOTSTRAP_ENABLED || "").trim().toLowerCase() === "true"
  && String(process.env.REEBS_ADMIN_BOOTSTRAP_SECRET || "").trim().length >= 32;
export const isValidAccountActivationPassword = (value) =>
  typeof value === "string" && value.trim().length >= 12 && value.length <= 1024;

const handleBootstrapStatus = async (client, event) => {
  if (event.httpMethod !== "GET") return respond(event, 405, { error: "Method not allowed." });
  if (!bootstrapConfigured()) return respond(event, 200, { available: false });
  const organizationId = await resolveConfiguredPublicOrganizationId(client);
  const result = await client.query(
    `SELECT NOT EXISTS (
       SELECT 1 FROM "user" WHERE "organizationId" = $1
     ) AS available`,
    [organizationId]
  );
  return respond(event, 200, { available: result.rows[0]?.available === true });
};

const handleBootstrap = async (client, event, payload) => {
  if (event.httpMethod !== "POST") return respond(event, 405, { error: "Method not allowed." });
  if (!isTrustedBrowserMutation(event)) return respond(event, 403, { error: "Request origin could not be verified." });
  const limit = await applyWindowRateLimit(client, {
    scope: "admin-bootstrap:ip",
    identifier: getRequestClientIp(event),
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) {
    return respond(event, 429, { error: "Too many setup attempts. Try again later.", retryAfterSeconds: limit.retryAfterSeconds });
  }
  if (!bootstrapConfigured() || !accountAccessSecretsMatch(payload.setupCode, process.env.REEBS_ADMIN_BOOTSTRAP_SECRET)) {
    return respond(event, 403, { error: "Administrator setup is unavailable or the setup code is invalid." });
  }
  const firstName = cleanNamePart(payload.firstName);
  const lastName = cleanNamePart(payload.lastName);
  const personalEmail = normalizePersonalEmail(payload.personalEmail);
  const password = typeof payload.password === "string" ? payload.password.trim() : "";
  if (!firstName || !lastName || !isValidPersonalEmail(personalEmail) || !isValidAccountActivationPassword(password)) {
    return respond(event, 400, { error: "Enter a first name, last name, valid personal email, and a password of at least 12 characters." });
  }

  const organizationId = await resolveConfiguredPublicOrganizationId(client);
  await client.query("BEGIN");
  try {
    await client.query(`SELECT id FROM "organization" WHERE id = $1 FOR UPDATE`, [organizationId]);
    const existing = await client.query(`SELECT id FROM "user" WHERE "organizationId" = $1 LIMIT 1`, [organizationId]);
    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return respond(event, 409, { error: "Administrator setup has already been completed." });
    }
    const passwordHash = await hashPassword(password);
    const created = await client.query(
      `INSERT INTO "user" (
         "organizationId", email, "personalEmail", password, "firstName", "lastName", "fullName", role, permissions, "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'Owner', '{}'::jsonb, NOW(), NOW())
       RETURNING id`,
      [organizationId, SYSTEM_ADMIN_EMAIL, personalEmail, passwordHash, firstName, lastName, buildFullName(firstName, lastName)]
    );
    await writeAuditLog(client, {
      userId: created.rows[0]?.id,
      organizationId,
      action: "ADMIN_BOOTSTRAP_COMPLETED",
      source: "auth",
      category: "access",
      severity: "warning",
      status: "ok",
      summary: "Created the first REEBS system administrator account.",
      actorLabel: buildFullName(firstName, lastName),
      requestId: getEventHeader(event, "x-request-id"),
      ipAddress: getEventIpAddress(event),
    });
    await client.query("COMMIT");
    return respond(event, 201, { message: "Administrator account created. Sign in with username system_admin." });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};

const handleCreateInvitation = async (client, event, payload) => {
  if (event.httpMethod !== "POST") return respond(event, 405, { error: "Method not allowed." });
  if (!isTrustedBrowserMutation(event)) return respond(event, 403, { error: "Request origin could not be verified." });
  const authUser = await requireUser(client, event);
  if (!authUser) return respond(event, 401, { error: "Unauthorized" });
  if (!canAccessUsersMethod(authUser, "POST")) return respond(event, 403, { error: "You do not have permission to invite users." });

  const firstName = cleanNamePart(payload.firstName);
  const lastName = cleanNamePart(payload.lastName);
  const roleKey = normalizeRoleKey(payload.role || "Staff");
  if (!firstName || !lastName || !VALID_USER_ROLE_KEYS.has(roleKey)) {
    return respond(event, 400, { error: "First name, last name, and a valid role are required." });
  }
  if (!canAssignUserRole(authUser, roleKey)) {
    return respond(event, 403, { error: "Only the system administrator can invite privileged or Water roles." });
  }
  const email = buildEmailFromNames(firstName, lastName);
  const duplicate = await client.query(`SELECT id FROM "user" WHERE LOWER(email) = LOWER($1) LIMIT 1`, [email]);
  if (duplicate.rowCount > 0) return respond(event, 409, { error: "That user account already exists." });

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  await client.query("BEGIN");
  try {
    await client.query(
      `UPDATE "userInvitation" SET "revokedAt" = NOW(), "updatedAt" = NOW()
       WHERE "organizationId" = $1 AND LOWER(email) = LOWER($2)
         AND "acceptedAt" IS NULL AND "revokedAt" IS NULL`,
      [authUser.organizationId, email]
    );
    await client.query(
      `INSERT INTO "userInvitation" (
         id, "organizationId", email, "firstName", "lastName", "fullName", role, permissions,
         "tokenHash", "createdByUserId", "expiresAt", "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'{}'::jsonb,$8,$9,$10,NOW(),NOW())`,
      [crypto.randomUUID(), authUser.organizationId, email, firstName, lastName, buildFullName(firstName, lastName), formatStoredRole(roleKey), hashAccountAccessToken(token), authUser.id, expiresAt]
    );
    await writeAuditLog(client, {
      userId: authUser.id,
      organizationId: authUser.organizationId,
      action: "USER_INVITATION_CREATED",
      targetType: "userInvitation",
      category: "access",
      severity: ["owner", "admin", "water"].includes(roleKey) ? "warning" : "info",
      status: "ok",
      summary: `Created a ${formatStoredRole(roleKey)} account invitation.`,
      actorLabel: authUser.fullName || authUser.email,
      requestId: getEventHeader(event, "x-request-id"),
      ipAddress: getEventIpAddress(event),
      metadata: { assignedRole: formatStoredRole(roleKey) },
    });
    await client.query("COMMIT");
    return respond(event, 201, { token, email, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
};

const handleAcceptInvitation = async (client, event, payload) => {
  if (event.httpMethod !== "POST") return respond(event, 405, { error: "Method not allowed." });
  if (!isTrustedBrowserMutation(event)) return respond(event, 403, { error: "Request origin could not be verified." });
  const limit = await applyWindowRateLimit(client, {
    scope: "user-invitation:ip",
    identifier: getRequestClientIp(event),
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limit.allowed) return respond(event, 429, { error: "Too many activation attempts. Try again later.", retryAfterSeconds: limit.retryAfterSeconds });
  const token = String(payload.token || "").trim();
  const password = typeof payload.password === "string" ? payload.password.trim() : "";
  const personalEmail = normalizePersonalEmail(payload.personalEmail);
  if (token.length < 32 || !isValidAccountActivationPassword(password) || !isValidPersonalEmail(personalEmail)) {
    return respond(event, 400, { error: "Enter a valid invitation, personal email, and a password of at least 12 characters." });
  }

  await client.query("BEGIN");
  try {
    const result = await client.query(
      `SELECT * FROM "userInvitation"
       WHERE "tokenHash" = $1 AND "acceptedAt" IS NULL AND "revokedAt" IS NULL AND "expiresAt" > NOW()
       LIMIT 1 FOR UPDATE`,
      [hashAccountAccessToken(token)]
    );
    const invitation = result.rows[0];
    if (!invitation) {
      await client.query("ROLLBACK");
      return respond(event, 400, { error: "This invitation is invalid, expired, or already used." });
    }
    const passwordHash = await hashPassword(password);
    const created = await client.query(
      `INSERT INTO "user" (
         "organizationId", email, "personalEmail", password, "firstName", "lastName", "fullName", role, permissions, "createdAt", "updatedAt"
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
       RETURNING id`,
      [invitation.organizationId, invitation.email, personalEmail, passwordHash, invitation.firstName, invitation.lastName, invitation.fullName, invitation.role, invitation.permissions || {}]
    );
    await client.query(`UPDATE "userInvitation" SET "acceptedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`, [invitation.id]);
    await writeAuditLog(client, {
      userId: created.rows[0]?.id,
      organizationId: invitation.organizationId,
      action: "USER_INVITATION_ACCEPTED",
      targetType: "user",
      targetId: String(created.rows[0]?.id || ""),
      source: "auth",
      category: "access",
      severity: "info",
      status: "ok",
      summary: "Activated a REEBS user account from a single-use invitation.",
      actorLabel: invitation.fullName,
      requestId: getEventHeader(event, "x-request-id"),
      ipAddress: getEventIpAddress(event),
      metadata: { assignedRole: invitation.role },
    });
    await client.query("COMMIT");
    return respond(event, 201, { message: "Account activated. You can now sign in.", username: String(invitation.email).split("@")[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error?.code === "23505") return respond(event, 409, { error: "That account or personal email is already in use." });
    throw error;
  }
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return respond(event, 204);
  const payload = event.httpMethod === "POST" ? parseBody(event) : {};
  if (payload === null) return respond(event, 400, { error: "Invalid JSON body." });
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: resolvePgSslConfig() });
  try {
    await client.connect();
    const path = requestPath(event);
    if (path.endsWith("/bootstrap/status")) return await handleBootstrapStatus(client, event);
    if (path.endsWith("/bootstrap")) return await handleBootstrap(client, event, payload);
    if (path.endsWith("/invitations/accept")) return await handleAcceptInvitation(client, event, payload);
    if (path.endsWith("/invitations")) return await handleCreateInvitation(client, event, payload);
    return respond(event, 404, { error: "Account access route not found." });
  } catch (error) {
    logger.error({ err: error }, "Account access request failed");
    return respond(event, 500, { error: "Unable to complete the account request." });
  } finally {
    await client.end().catch(() => {});
  }
}
