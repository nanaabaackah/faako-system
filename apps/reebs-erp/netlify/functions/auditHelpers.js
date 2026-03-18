// Shared helpers for tagging records with a user and keeping audit columns in sync.
// These run lightweight defensive DDL so existing databases can be backfilled in-place.
import "../../runtimeEnv.js";

const addColumnStatements = [
  `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "assignedUserId" INTEGER`,
  `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER`,
  `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER`,
  `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "lastModifiedAt" TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "assignedUserId" INTEGER`,
  `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER`,
  `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER`,
  `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "lastModifiedAt" TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "lastUpdatedByUserId" INTEGER`,
  `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "lastUpdatedAt" TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "performedByUserId" INTEGER`,
  `ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "performedByName" TEXT`,
  `ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "performedByEmail" TEXT`,
  `ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW()`,
  `ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "soldMonth" DATE`,
];

export const ensureAuditColumns = async (client) => {
  // Run sequentially to avoid lock errors on some Postgres providers.
  for (const statement of addColumnStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      // Keep going if a provider doesn't allow IF NOT EXISTS on a given column.
      console.warn("Audit column check failed:", err?.message || err);
    }
  }
};

export const findDefaultAdmin = async (client, organizationId = null) => {
  const hasOrg = Number.isFinite(Number(organizationId));
  const orgClause = hasOrg ? ` AND "organizationId" = $1` : "";
  const orgValues = hasOrg ? [organizationId] : [];
  const admin = await client.query(
    `SELECT id, "fullName", email
     FROM "user"
     WHERE role ILIKE 'admin'${orgClause}
     ORDER BY id ASC
     LIMIT 1`,
    orgValues
  );
  if (admin.rowCount > 0) return admin.rows[0];

  const anyUser = await client.query(
    `SELECT id, "fullName", email
     FROM "user"
     ${hasOrg ? `WHERE "organizationId" = $1` : ""}
     ORDER BY id ASC
     LIMIT 1`,
    orgValues
  );
  return anyUser.rows[0] || null;
};

export const normalizeActor = (raw) => {
  const parsedId = Number(raw?.userId);
  return {
    userId: Number.isFinite(parsedId) ? parsedId : null,
    userName: typeof raw?.userName === "string" ? raw.userName : null,
    userEmail: typeof raw?.userEmail === "string" ? raw.userEmail : null,
  };
};

export const resolveActor = async (client, rawActor, organizationId = null) => {
  const actor = normalizeActor(rawActor);
  const fallback = await findDefaultAdmin(client, organizationId);
  return {
    userId: actor.userId ?? fallback?.id ?? null,
    userName: actor.userName || fallback?.fullName || "Admin",
    userEmail: actor.userEmail || fallback?.email || null,
  };
};

export const backfillAuditDefaults = async (client, adminUserId, organizationId = null) => {
  if (!adminUserId) return;
  const hasOrg = Number.isFinite(Number(organizationId));
  const orgClause = hasOrg ? ` AND "organizationId" = $2` : "";
  const values = hasOrg ? [adminUserId, organizationId] : [adminUserId];

  await client.query(
    `UPDATE "order"
     SET "assignedUserId" = COALESCE("assignedUserId", $1),
         "createdByUserId" = COALESCE("createdByUserId", $1),
         "updatedByUserId" = COALESCE("updatedByUserId", $1),
         "lastModifiedAt" = COALESCE("lastModifiedAt", "updatedAt", NOW())
     WHERE "assignedUserId" IS NULL
        OR "createdByUserId" IS NULL
        OR "updatedByUserId" IS NULL
        OR "lastModifiedAt" IS NULL${orgClause}`,
    values
  );

  await client.query(
    `UPDATE "booking"
     SET "assignedUserId" = COALESCE("assignedUserId", $1),
         "createdByUserId" = COALESCE("createdByUserId", $1),
         "updatedByUserId" = COALESCE("updatedByUserId", $1),
         "lastModifiedAt" = COALESCE("lastModifiedAt", "updatedAt", NOW()),
         "updatedAt" = COALESCE("updatedAt", NOW())
     WHERE "assignedUserId" IS NULL
        OR "createdByUserId" IS NULL
        OR "updatedByUserId" IS NULL
        OR "lastModifiedAt" IS NULL
        OR "updatedAt" IS NULL${orgClause}`,
    values
  );

  await client.query(
    `UPDATE "product"
     SET "lastUpdatedByUserId" = COALESCE("lastUpdatedByUserId", $1),
         "lastUpdatedAt" = COALESCE("lastUpdatedAt", NOW())
     WHERE "lastUpdatedByUserId" IS NULL
        OR "lastUpdatedAt" IS NULL${orgClause}`,
    values
  );

  await client.query(
    `UPDATE "stockMovement"
     SET "performedByUserId" = COALESCE("performedByUserId", $1),
         "performedByName" = COALESCE("performedByName", 'Admin'),
         "createdAt" = COALESCE("createdAt", NOW())
     WHERE "performedByUserId" IS NULL
        OR "performedByName" IS NULL
        OR "createdAt" IS NULL${orgClause}`,
    values
  );
};
