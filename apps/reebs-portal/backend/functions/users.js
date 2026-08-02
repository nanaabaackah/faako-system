/* eslint-disable no-undef */
// Filename: users.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { hashPassword } from "../../utils/passwords.js";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import {
  hasPermission,
  isSystemAdminUser,
  normalizeRole,
} from "./_shared/accessControl.js";
import { createLogger } from "./_shared/logger.js";
import { requireUser } from "./_shared/userAuth.js";
import { ensureUserSessionsTable } from "./_shared/userSessions.js";

const logger = createLogger("users");
const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: "GET,POST,PUT,OPTIONS" });

const cleanNamePart = (value) => (typeof value === "string" ? value.trim() : "");
const stripSpaces = (value) => cleanNamePart(value).replace(/\s+/g, "");
const buildEmailFromNames = (firstName, lastName) => {
  const first = stripSpaces(firstName).toLowerCase();
  const last = stripSpaces(lastName).toLowerCase();
  if (!first || !last) return null;
  return `${first}_${last}@reebs.com`;
};
const buildFullName = (firstName, lastName) => {
  return [cleanNamePart(firstName), cleanNamePart(lastName)].filter(Boolean).join(" ").trim();
};
const LEGACY_ROLE_ALIASES = {
  viewer: "staff",
  custodian: "staff",
  sales: "staff",
};
const VALID_USER_ROLE_KEYS = new Set([
  "owner",
  "admin",
  "manager",
  "staff",
  "warehouse",
  "driver",
  "water",
]);
const normalizeRoleKey = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return LEGACY_ROLE_ALIASES[normalized] || normalized;
};
const formatStoredRole = (value) => {
  const normalized = normalizeRoleKey(value);
  if (!normalized) return "";
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};
const resolveRoleFilterKeys = (value) => {
  const normalized = normalizeRoleKey(value);
  if (!normalized) return [];
  if (normalized === "staff") {
    return ["staff", "viewer", "custodian", "sales"];
  }
  return [normalized];
};
const normalizeUserRecord = (row = {}, { limited = false } = {}) => {
  const normalized = {
    ...row,
    role: formatStoredRole(row.role),
  };
  if (!limited) return normalized;
  return {
    id: normalized.id,
    email: normalized.email,
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    fullName: normalized.fullName,
    role: normalized.role,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
  };
};
const cleanPermissions = (value) => {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      return null;
    }
  }
  return null;
};

export const requiredUsersPermission = (method) =>
  String(method || "").toUpperCase() === "GET"
    ? "users:read"
    : "users:write";

export const canAccessUsersMethod = (user, method) => {
  const normalizedMethod = String(method || "").toUpperCase();
  if (isSystemAdminUser(user)) return true;
  if (normalizedMethod === "GET" && normalizeRole(user?.role) === "driver") {
    return true;
  }
  return hasPermission(user, requiredUsersPermission(normalizedMethod));
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204);
  }

  if (isCrossSiteBrowserRequest(event)) {
    return respond(event, 403, { error: "Cross-site requests are not allowed." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const method = event.httpMethod;
    let payload = null;
    if (method === "POST" || method === "PUT") {
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return respond(event, 400, { error: "Invalid JSON body." });
      }
    }

    const authUser = await requireUser(client, event);
    if (!authUser) {
      return respond(event, 401, { error: "Unauthorized" });
    }
    const organizationId = authUser.organizationId;
    const isSystemAdmin = isSystemAdminUser(authUser);
    const requesterRoleKey = normalizeRoleKey(authUser.role);
    if (!canAccessUsersMethod(authUser, method)) {
      return respond(event, 403, {
        error: "You do not have permission to manage users.",
      });
    }

    if (method === "POST") {
      const firstName = cleanNamePart(payload.firstName);
      const lastName = cleanNamePart(payload.lastName);
      const password = typeof payload.password === "string" ? payload.password.trim() : "";
      const roleKey = normalizeRoleKey(
        typeof payload.role === "string" && payload.role.trim() ? payload.role.trim() : "Staff"
      );
      const role = formatStoredRole(roleKey) || "Staff";
      const permissions = cleanPermissions(payload.permissions) || {};

      if (!firstName || !lastName) {
        return respond(event, 400, { error: "firstName and lastName are required." });
      }

      if (!VALID_USER_ROLE_KEYS.has(roleKey)) {
        return respond(event, 400, { error: "Invalid user role." });
      }

      const email = buildEmailFromNames(firstName, lastName);
      const fullName = buildFullName(firstName, lastName);

      if (!email) {
        return respond(event, 400, { error: "Could not generate email from name." });
      }

      if (!password) {
        return respond(event, 400, { error: "Password is required." });
      }

      try {
        const passwordHash = await hashPassword(password);
        const result = await client.query(
        `INSERT INTO "user" ("organizationId", "email", "password", "firstName", "lastName", "fullName", "role", permissions, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING id, email, "firstName", "lastName", "fullName", role, permissions, "createdAt", "updatedAt"`,
          [organizationId, email, passwordHash, firstName, lastName, fullName, role, permissions]
        );

        return respond(event, 201, normalizeUserRecord(result.rows[0]));
      } catch (err) {
        if (err?.code === "23505") {
          return respond(event, 409, { error: "User already exists (duplicate email)." });
        }
        throw err;
      }
    }

    if (method === "PUT") {
      const id = Number(payload.id);
      if (!Number.isFinite(id)) {
        return respond(event, 400, { error: "User id is required." });
      }

      const firstNameRaw = payload.firstName;
      const lastNameRaw = payload.lastName;
      const firstName = firstNameRaw === undefined ? null : cleanNamePart(firstNameRaw);
      const lastName = lastNameRaw === undefined ? null : cleanNamePart(lastNameRaw);
      const requestedRole =
        typeof payload.role === "string" && payload.role.trim() ? payload.role.trim() : null;
      const parsedPermissions = cleanPermissions(payload.permissions);
      const requestedRoleNormalized = requestedRole ? normalizeRoleKey(requestedRole) : null;
      const role = requestedRoleNormalized ? formatStoredRole(requestedRoleNormalized) : null;
      const password = typeof payload.password === "string" ? payload.password.trim() : null;

      const existingRes = await client.query(
        `SELECT "firstName", "lastName", role
         FROM "user" WHERE id = $1 AND "organizationId" = $2`,
        [id, organizationId]
      );
      if (existingRes.rowCount === 0) {
        return respond(event, 404, { error: "User not found." });
      }

      const current = existingRes.rows[0];
      const nextFirstName = firstName === null ? current.firstName : firstName;
      const nextLastName = lastName === null ? current.lastName : lastName;

      const currentRoleNormalized = normalizeRoleKey(current.role);
      const wantsRoleChange =
        requestedRoleNormalized && requestedRoleNormalized !== currentRoleNormalized;
      if (wantsRoleChange && !isSystemAdmin) {
        return respond(event, 403, { error: "Only system administrator can change roles." });
      }

      if (requestedRoleNormalized && !VALID_USER_ROLE_KEYS.has(requestedRoleNormalized)) {
        return respond(event, 400, { error: "Invalid user role." });
      }

      if (!nextFirstName || !nextLastName) {
        return respond(event, 400, { error: "Users must have both firstName and lastName." });
      }

      const updates = [];
      const values = [];
      let index = 1;

      if (firstName !== null) {
        updates.push(`"firstName" = $${index++}`);
        values.push(nextFirstName);
      }

      if (lastName !== null) {
        updates.push(`"lastName" = $${index++}`);
        values.push(nextLastName);
      }

      if (firstName !== null || lastName !== null) {
        const newEmail = buildEmailFromNames(nextFirstName, nextLastName);
        const newFullName = buildFullName(nextFirstName, nextLastName);
        updates.push(`"email" = $${index++}`);
        values.push(newEmail);
        updates.push(`"fullName" = $${index++}`);
        values.push(newFullName);
      }

      if (role) {
        updates.push(`"role" = $${index++}`);
        values.push(role);
      }

      if (parsedPermissions !== null) {
        updates.push(`"permissions" = $${index++}`);
        values.push(parsedPermissions);
      }

      if (password) {
        const passwordHash = await hashPassword(password);
        updates.push(`"password" = $${index++}`);
        values.push(passwordHash);
      }

      updates.push(`"updatedAt" = NOW()`);

      if (updates.length === 1) {
        return respond(event, 400, { error: "No fields to update." });
      }

      values.push(id);
      values.push(organizationId);

      try {
        const result = await client.query(
          `UPDATE "user" SET ${updates.join(", ")}
           WHERE id = $${index} AND "organizationId" = $${index + 1}
           RETURNING id, email, "firstName", "lastName", "fullName", role, permissions, "createdAt", "updatedAt"`,
          values
        );

        if (result.rowCount === 0) {
          return respond(event, 404, { error: "User not found." });
        }

        return respond(event, 200, normalizeUserRecord(result.rows[0]));
      } catch (err) {
        if (err?.code === "23505") {
          return respond(event, 409, { error: "Duplicate email." });
        }
        throw err;
      }
    }

    if (method !== "GET") {
      return respond(event, 405, { error: "Method Not Allowed" });
    }

    await ensureUserSessionsTable(client);
    const requestedRoleFilter = event.queryStringParameters?.role || "";
    const effectiveRoleFilterKeys =
      requesterRoleKey === "driver"
        ? ["driver"]
        : resolveRoleFilterKeys(requestedRoleFilter);
    const values = [organizationId];
    const roleFilterClause = effectiveRoleFilterKeys.length
      ? ` AND LOWER(u.role) = ANY($2)`
      : "";
    if (effectiveRoleFilterKeys.length) {
      values.push(effectiveRoleFilterKeys);
    }

    const result = await client.query(
      `SELECT
         u.id,
         u.email,
         u."firstName",
         u."lastName",
         u."fullName",
         u.role,
         u.permissions,
         u."createdAt",
         u."updatedAt",
         COALESCE(session_meta."activeSessionCount", 0) AS "activeSessionCount",
         session_meta."lastSessionAt",
         COALESCE(session_meta.sessions, '[]'::json) AS sessions
         FROM "user" u
       LEFT JOIN LATERAL (
         SELECT
           (
             SELECT COUNT(*)::int
             FROM "userSession" us_count
             WHERE us_count."organizationId" = u."organizationId"
               AND us_count."userId" = u.id
               AND us_count."revokedAt" IS NULL
               AND us_count."expiresAt" > NOW()
           ) AS "activeSessionCount",
           (
             SELECT MAX(us_last."lastSeenAt")
             FROM "userSession" us_last
             WHERE us_last."organizationId" = u."organizationId"
               AND us_last."userId" = u.id
               AND us_last."revokedAt" IS NULL
               AND us_last."expiresAt" > NOW()
           ) AS "lastSessionAt",
           (
             SELECT JSON_AGG(
               JSON_BUILD_OBJECT(
                 'id', active.id,
                 'createdAt', active."createdAt",
                 'lastSeenAt', active."lastSeenAt",
                 'expiresAt', active."expiresAt",
                 'remember', active."remember",
                 'ipAddress', active."ipAddress",
                 'userAgent', active."userAgent"
               )
               ORDER BY active."lastSeenAt" DESC NULLS LAST, active."createdAt" DESC
             )
             FROM (
               SELECT
                 id,
                 "createdAt",
                 "lastSeenAt",
                 "expiresAt",
                 "remember",
                 "ipAddress",
                 "userAgent"
               FROM "userSession"
               WHERE "organizationId" = u."organizationId"
                 AND "userId" = u.id
                 AND "revokedAt" IS NULL
                 AND "expiresAt" > NOW()
               ORDER BY "lastSeenAt" DESC NULLS LAST, "createdAt" DESC
               LIMIT 5
             ) active
           ) AS sessions
       ) session_meta ON TRUE
       WHERE u."organizationId" = $1${roleFilterClause}
       ORDER BY u.id DESC`,
      values
    );

    return respond(
      event,
      200,
      (result.rows || []).map((row) => normalizeUserRecord(row, { limited: requesterRoleKey === "driver" }))
    );
  } catch (err) {
    logger.error(
      {
        err,
        eventName: "users.request.failed",
        requestId: event?.requestId,
      },
      "REEBS users request failed"
    );
    return respond(event, 500, { error: "Unable to complete the users request." });
  } finally {
    await client.end().catch(() => {});
  }
}
