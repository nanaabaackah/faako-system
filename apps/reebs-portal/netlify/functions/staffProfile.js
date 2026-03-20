/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { hashPassword } from "../../utils/passwords.js";
import { isCrossSiteBrowserRequest, json } from "./_shared/http.js";
import { requireUser } from "./_shared/userAuth.js";
import { ensureUserImageUrlColumn, normalizeProfileImageUrl } from "./_shared/userProfileImage.js";
import {
  ensureUserPersonalEmailColumn,
  isValidPersonalEmail,
  normalizePersonalEmail,
} from "./_shared/userPersonalEmail.js";

const respond = (event, statusCode, body = {}) =>
  json(event, statusCode, body, { methods: "GET, PUT, OPTIONS" });

const profileTableStatements = [
  `CREATE TABLE IF NOT EXISTS "employeeProfile" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER DEFAULT 1,
    "userId" INTEGER NOT NULL,
    "jobTitle" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
  `ALTER TABLE "employeeProfile" ADD COLUMN IF NOT EXISTS "address" TEXT`,
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
    } catch (error) {
      console.warn("Employee profile table check failed:", error?.message || error);
    }
  }

  try {
    await client.query(`ALTER TABLE "employeeProfile" ALTER COLUMN "organizationId" SET DEFAULT 1`);
    await client.query(
      `UPDATE "employeeProfile" p
       SET "organizationId" = u."organizationId"
       FROM "user" u
       WHERE p."userId" = u.id
         AND (p."organizationId" IS NULL OR p."organizationId" = 1)`,
    );
  } catch (error) {
    console.warn("Employee profile organization backfill failed:", error?.message || error);
  }
};

const cleanString = (value) => (typeof value === "string" ? value.trim() : "");
const stripSpaces = (value) => cleanString(value).replace(/\s+/g, "");

const buildEmailFromNames = (firstName, lastName) => {
  const first = stripSpaces(firstName).toLowerCase();
  const last = stripSpaces(lastName).toLowerCase();
  if (!first || !last) return null;
  return `${first}_${last}@reebs.com`;
};

const buildFullName = (firstName, lastName) =>
  [cleanString(firstName), cleanString(lastName)].filter(Boolean).join(" ").trim();

const selectCurrentProfile = async (client, userId, organizationId) => {
  const result = await client.query(
    `SELECT
      u.id,
      u.email,
      u."personalEmail",
      u."firstName",
      u."lastName",
      u."fullName",
      u.role,
      u."imageUrl",
      u."createdAt",
      u."updatedAt",
      p."jobTitle",
      p."phone",
      p."address"
    FROM "user" u
    LEFT JOIN "employeeProfile" p ON p."userId" = u.id
    WHERE u.id = $1 AND u."organizationId" = $2
    LIMIT 1`,
    [userId, organizationId],
  );

  return result.rows[0] || null;
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204);
  }

  if (!["GET", "PUT"].includes(event.httpMethod || "")) {
    return respond(event, 405, { error: "Method not allowed." });
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
    const authUser = await requireUser(client, event);
    if (!authUser) {
      return respond(event, 401, { error: "Unauthorized" });
    }

    await ensureUserImageUrlColumn(client);
    await ensureUserPersonalEmailColumn(client);
    await ensureEmployeeProfileTable(client);

    const userId = Number(authUser.id);
    const organizationId = Number(authUser.organizationId);

    if (event.httpMethod === "GET") {
      const profile = await selectCurrentProfile(client, userId, organizationId);
      if (!profile) {
        return respond(event, 404, { error: "Profile not found." });
      }
      return respond(event, 200, profile);
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return respond(event, 400, { error: "Invalid JSON body." });
    }

    const currentProfile = await selectCurrentProfile(client, userId, organizationId);
    if (!currentProfile) {
      return respond(event, 404, { error: "Profile not found." });
    }

    const firstName = cleanString(payload.firstName || currentProfile.firstName);
    const lastName = cleanString(payload.lastName || currentProfile.lastName);
    const password = typeof payload.password === "string" ? payload.password.trim() : "";
    const jobTitle = cleanString(payload.jobTitle) || null;
    const phone = cleanString(payload.phone) || null;
    const address = cleanString(payload.address) || null;
    const personalEmailProvided = Object.prototype.hasOwnProperty.call(payload, "personalEmail");
    const nextPersonalEmail = personalEmailProvided
      ? normalizePersonalEmail(payload.personalEmail) || null
      : normalizePersonalEmail(currentProfile.personalEmail) || null;
    const profileImageInput = normalizeProfileImageUrl(payload.imageUrl);

    if (profileImageInput.error) {
      return respond(event, 400, { error: profileImageInput.error });
    }
    if (!firstName || !lastName) {
      return respond(event, 400, { error: "First and last name are required." });
    }
    if (personalEmailProvided && !isValidPersonalEmail(nextPersonalEmail)) {
      return respond(event, 400, { error: "Enter a valid personal email address." });
    }

    const nextEmail = buildEmailFromNames(firstName, lastName);
    if (!nextEmail) {
      return respond(event, 400, { error: "Could not generate email from name." });
    }
    const fullName = buildFullName(firstName, lastName);

    if (nextPersonalEmail) {
      const personalEmailConflict = await client.query(
        `SELECT id
         FROM "user"
         WHERE "organizationId" = $1
           AND LOWER("personalEmail") = $2
           AND id <> $3
         LIMIT 1`,
        [organizationId, nextPersonalEmail, userId]
      );
      if (personalEmailConflict.rowCount > 0) {
        return respond(event, 409, { error: "That personal email is already assigned to another user." });
      }
    }

    const userUpdates = [
      `"firstName" = $1`,
      `"lastName" = $2`,
      `"fullName" = $3`,
      `"email" = $4`,
      `"personalEmail" = $5`,
      `"imageUrl" = $6`,
      `"updatedAt" = NOW()`,
    ];
    const userValues = [
      firstName,
      lastName,
      fullName,
      nextEmail,
      nextPersonalEmail,
      profileImageInput.provided ? profileImageInput.value : currentProfile.imageUrl || null,
    ];

    if (password) {
      const passwordHash = await hashPassword(password);
      userUpdates.splice(userUpdates.length - 1, 0, `"password" = $${userValues.length + 1}`);
      userValues.push(passwordHash);
    }

    userValues.push(userId);
    userValues.push(organizationId);

    await client.query(
      `UPDATE "user" SET ${userUpdates.join(", ")}
       WHERE id = $${userValues.length - 1} AND "organizationId" = $${userValues.length}`,
      userValues,
    );

    await client.query(
      `INSERT INTO "employeeProfile"
        ("organizationId", "userId", "jobTitle", "phone", "address", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT ("userId") DO UPDATE SET
         "organizationId" = EXCLUDED."organizationId",
         "jobTitle" = EXCLUDED."jobTitle",
         "phone" = EXCLUDED."phone",
         "address" = EXCLUDED."address",
         "updatedAt" = NOW()`,
      [organizationId, userId, jobTitle, phone, address],
    );

    const updatedProfile = await selectCurrentProfile(client, userId, organizationId);
    return respond(event, 200, updatedProfile);
  } catch (error) {
    console.error("Staff profile error:", error);
    return respond(event, 500, { error: error?.message || "Failed to update profile." });
  } finally {
    await client.end().catch(() => {});
  }
}
