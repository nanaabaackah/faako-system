/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { ensureAuditColumns, backfillAuditDefaults } from "./auditHelpers.js";
import { requireUser } from "./_shared/userAuth.js";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const profileTableStatements = [
  `CREATE TABLE IF NOT EXISTS "employeeProfile" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "jobTitle" TEXT,
    "phone" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "userId" INTEGER`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "employeeProfile_userId_key" ON "employeeProfile" ("userId")`,
  `ALTER TABLE "employeeProfile"
    ADD CONSTRAINT "employeeProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE`,
];

const ensureEmployeeProfileTable = async (client) => {
  for (const statement of profileTableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Employee profile table check failed:", err?.message || err);
    }
  }
};

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
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
    const authUser = await requireUser(client, event);
    if (!authUser) {
      return json(401, { error: "Unauthorized" });
    }
    const organizationId = authUser.organizationId;
    await ensureAuditColumns(client);
    await ensureEmployeeProfileTable(client);
    await backfillAuditDefaults(client, authUser.id, organizationId);

    if (event.httpMethod === "GET") {
      const staff = await client.query(
        `SELECT
          u.id,
          u."firstName",
          u."lastName",
          u."fullName",
          u.email,
          u.role,
          u."createdAt",
          u."updatedAt",
          p."jobTitle",
          p."phone",
          p."emergencyContactName",
          p."emergencyContactPhone",
          COALESCE(order_stats.orders, 0)::int AS orders,
          COALESCE(booking_stats.bookings, 0)::int AS bookings,
          COALESCE(stock_stats.movements, 0)::int AS "stockMovements"
        FROM "user" u
        LEFT JOIN "employeeProfile" p ON p."userId" = u.id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS orders
          FROM "order" o
          WHERE o."organizationId" = $1
            AND (u.id = COALESCE(o."assignedUserId", o."createdByUserId")
             OR u.id = o."updatedByUserId"
            )
        ) order_stats ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS bookings
          FROM "booking" b
          WHERE b."organizationId" = $1
            AND (u.id = COALESCE(b."assignedUserId", b."createdByUserId")
             OR u.id = b."updatedByUserId"
            )
        ) booking_stats ON true
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS movements
          FROM "stockMovement" sm
          WHERE sm."organizationId" = $1
            AND u.id = sm."performedByUserId"
        ) stock_stats ON true
        WHERE u."organizationId" = $1
        ORDER BY u."fullName" ASC NULLS LAST, u.id ASC`,
        [organizationId]
      );
      return json(200, staff.rows || []);
    }

    if (event.httpMethod !== "PUT") {
      return json(405, { error: "Method not allowed." });
    }

    let data = {};
    try {
      data = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    const id = Number(data.id);
    if (!Number.isFinite(id)) {
      return json(400, { error: "Employee id is required." });
    }

    const currentRes = await client.query(
      `SELECT "firstName", "lastName", role
       FROM "user"
       WHERE id = $1 AND "organizationId" = $2`,
      [id, organizationId]
    );
    if (currentRes.rowCount === 0) {
      return json(404, { error: "Employee not found." });
    }

    const currentUser = currentRes.rows[0];
    const firstName = data.firstName === undefined ? currentUser.firstName : cleanString(data.firstName);
    const lastName = data.lastName === undefined ? currentUser.lastName : cleanString(data.lastName);
    const role = data.role === undefined ? currentUser.role : cleanString(data.role) || currentUser.role;
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

    const userUpdates = [];
    const userValues = [];
    let userIndex = 1;

    if (data.firstName !== undefined) {
      userUpdates.push(`"firstName" = $${userIndex++}`);
      userValues.push(firstName);
    }
    if (data.lastName !== undefined) {
      userUpdates.push(`"lastName" = $${userIndex++}`);
      userValues.push(lastName);
    }
    if (data.firstName !== undefined || data.lastName !== undefined) {
      userUpdates.push(`"fullName" = $${userIndex++}`);
      userValues.push(fullName);
    }
    if (data.role !== undefined) {
      userUpdates.push(`role = $${userIndex++}`);
      userValues.push(role);
    }

    if (userUpdates.length) {
      userUpdates.push(`"updatedAt" = NOW()`);
      userValues.push(id);
      userValues.push(organizationId);
      await client.query(
        `UPDATE "user" SET ${userUpdates.join(", ")} WHERE id = $${userIndex} AND "organizationId" = $${userIndex + 1}`,
        userValues
      );
    }

    const profileFields = {
      jobTitle: data.jobTitle === undefined ? undefined : cleanString(data.jobTitle) || null,
      phone: data.phone === undefined ? undefined : cleanString(data.phone) || null,
      emergencyContactName:
        data.emergencyContactName === undefined ? undefined : cleanString(data.emergencyContactName) || null,
      emergencyContactPhone:
        data.emergencyContactPhone === undefined ? undefined : cleanString(data.emergencyContactPhone) || null,
    };

    const shouldUpdateProfile = Object.values(profileFields).some((value) => value !== undefined);
    if (shouldUpdateProfile) {
      const existingProfile = await client.query(
        `SELECT "jobTitle", "phone", "emergencyContactName", "emergencyContactPhone"
         FROM "employeeProfile"
         WHERE "userId" = $1`,
        [id]
      );
      const currentProfile = existingProfile.rows[0] || {};
      const nextProfile = {
        jobTitle:
          profileFields.jobTitle === undefined ? currentProfile.jobTitle || null : profileFields.jobTitle,
        phone: profileFields.phone === undefined ? currentProfile.phone || null : profileFields.phone,
        emergencyContactName:
          profileFields.emergencyContactName === undefined
            ? currentProfile.emergencyContactName || null
            : profileFields.emergencyContactName,
        emergencyContactPhone:
          profileFields.emergencyContactPhone === undefined
            ? currentProfile.emergencyContactPhone || null
            : profileFields.emergencyContactPhone,
      };

      await client.query(
        `INSERT INTO "employeeProfile"
          ("userId", "jobTitle", "phone", "emergencyContactName", "emergencyContactPhone", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT ("userId") DO UPDATE SET
           "jobTitle" = EXCLUDED."jobTitle",
           "phone" = EXCLUDED."phone",
           "emergencyContactName" = EXCLUDED."emergencyContactName",
           "emergencyContactPhone" = EXCLUDED."emergencyContactPhone",
           "updatedAt" = NOW()`,
        [
          id,
          nextProfile.jobTitle,
          nextProfile.phone,
          nextProfile.emergencyContactName,
          nextProfile.emergencyContactPhone,
        ]
      );
    }

    const updated = await client.query(
      `SELECT
        u.id,
        u."firstName",
        u."lastName",
        u."fullName",
        u.email,
        u.role,
        u."createdAt",
        u."updatedAt",
        p."jobTitle",
        p."phone",
        p."emergencyContactName",
        p."emergencyContactPhone"
      FROM "user" u
      LEFT JOIN "employeeProfile" p ON p."userId" = u.id
      WHERE u.id = $1 AND u."organizationId" = $2`,
      [id, organizationId]
    );

    return json(200, updated.rows[0]);
  } catch (err) {
    console.error("❌ HR error:", err);
    return json(500, { error: "Failed to process HR request" });
  } finally {
    await client.end().catch(() => {});
  }
}
