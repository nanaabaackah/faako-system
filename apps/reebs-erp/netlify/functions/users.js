/* eslint-disable no-undef */
// Filename: users.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { hashPassword } from "../../utils/passwords.js";
import { requireUser } from "./_shared/userAuth.js";
import { ensureUserSessionsTable } from "./_shared/userSessions.js";

const SYSTEM_ADMIN_EMAIL = "system_admin@reebs.com";
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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      },
      body: "",
    };
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
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Invalid JSON body." }),
        };
      }
    }

    const authUser = await requireUser(client, event);
    if (!authUser) {
      return {
        statusCode: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }
    const organizationId = authUser.organizationId;
    const isSystemAdmin = (authUser.email || "").toLowerCase() === SYSTEM_ADMIN_EMAIL;

    if (method === "POST") {
      const firstName = cleanNamePart(payload.firstName);
      const lastName = cleanNamePart(payload.lastName);
      const password = typeof payload.password === "string" ? payload.password.trim() : "";
      const role = typeof payload.role === "string" && payload.role.trim() ? payload.role.trim() : "Staff";
      const permissions = cleanPermissions(payload.permissions) || {};

      if (!firstName || !lastName) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "firstName and lastName are required." }),
        };
      }

      const email = buildEmailFromNames(firstName, lastName);
      const fullName = buildFullName(firstName, lastName);

      if (!email) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Could not generate email from name." }),
        };
      }

      if (!password) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Password is required." }),
        };
      }

      try {
        const passwordHash = await hashPassword(password);
        const result = await client.query(
        `INSERT INTO "user" ("organizationId", "email", "password", "firstName", "lastName", "fullName", "role", permissions, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING id, email, "firstName", "lastName", "fullName", role, permissions, "createdAt", "updatedAt"`,
          [organizationId, email, passwordHash, firstName, lastName, fullName, role, permissions]
        );

        return {
          statusCode: 201,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(result.rows[0]),
        };
      } catch (err) {
        if (err?.code === "23505") {
          return {
            statusCode: 409,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "User already exists (duplicate email)." }),
          };
        }
        throw err;
      }
    }

    if (method === "PUT") {
      const id = Number(payload.id);
      if (!Number.isFinite(id)) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "User id is required." }),
        };
      }

      const firstNameRaw = payload.firstName;
      const lastNameRaw = payload.lastName;
      const firstName = firstNameRaw === undefined ? null : cleanNamePart(firstNameRaw);
      const lastName = lastNameRaw === undefined ? null : cleanNamePart(lastNameRaw);
      const requestedRole =
        typeof payload.role === "string" && payload.role.trim() ? payload.role.trim() : null;
      const parsedPermissions = cleanPermissions(payload.permissions);
      const role = requestedRole;
      const password = typeof payload.password === "string" ? payload.password.trim() : null;

      const existingRes = await client.query(
        `SELECT "firstName", "lastName", role
         FROM "user" WHERE id = $1 AND "organizationId" = $2`,
        [id, organizationId]
      );
      if (existingRes.rowCount === 0) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "User not found." }),
        };
      }

      const current = existingRes.rows[0];
      const nextFirstName = firstName === null ? current.firstName : firstName;
      const nextLastName = lastName === null ? current.lastName : lastName;

      const currentRoleNormalized = (current.role || "").toLowerCase();
      const requestedRoleNormalized = requestedRole ? requestedRole.toLowerCase() : null;
      const wantsRoleChange =
        requestedRoleNormalized && requestedRoleNormalized !== currentRoleNormalized;
      if (wantsRoleChange && !isSystemAdmin) {
        return {
          statusCode: 403,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Only system administrator can change roles." }),
        };
      }

      if (!nextFirstName || !nextLastName) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Users must have both firstName and lastName." }),
        };
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
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "No fields to update." }),
        };
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
          return {
            statusCode: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "User not found." }),
          };
        }

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(result.rows[0]),
        };
      } catch (err) {
        if (err?.code === "23505") {
          return {
            statusCode: 409,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "Duplicate email." }),
          };
        }
        throw err;
      }
    }

    if (method !== "GET") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    await ensureUserSessionsTable(client);

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
       WHERE u."organizationId" = $1
       ORDER BY u.id DESC`,
      [organizationId]
    );

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(result.rows),
    };
  } catch (err) {
    console.error("❌ Database error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Database error" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
