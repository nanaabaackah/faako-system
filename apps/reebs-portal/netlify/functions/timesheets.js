/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { hasAnyRole, requireInternalUser, respond } from "./_shared/internalApi.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,POST,OPTIONS" });

const PRIVILEGED_ROLES = ["owner", "admin", "manager"];

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "timesheet" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "userId" INTEGER NOT NULL,
    "clockIn" TIMESTAMPTZ NOT NULL,
    "clockOut" TIMESTAMPTZ,
    "clockInLat" DOUBLE PRECISION,
    "clockInLng" DOUBLE PRECISION,
    "clockOutLat" DOUBLE PRECISION,
    "clockOutLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockOut" TIMESTAMPTZ`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockInLat" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockInLng" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockOutLat" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockOutLng" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE INDEX IF NOT EXISTS "timesheet_userId_idx" ON "timesheet" ("userId")`,
  `CREATE INDEX IF NOT EXISTS "timesheet_org_user_idx" ON "timesheet" ("organizationId", "userId")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'timesheet_userId_fkey'
     ) THEN
       ALTER TABLE "timesheet"
         ADD CONSTRAINT "timesheet_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "user"("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$;`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'timesheet_organizationId_fkey'
     ) THEN
       ALTER TABLE "timesheet"
         ADD CONSTRAINT "timesheet_organizationId_fkey"
         FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
         ON DELETE RESTRICT ON UPDATE CASCADE;
     END IF;
   END $$;`,
];

const ensureTimesheetTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Timesheet table check failed:", err?.message || err);
    }
  }

  try {
    await client.query(
      `UPDATE "timesheet" ts
       SET "organizationId" = u."organizationId"
       FROM "user" u
       WHERE ts."userId" = u.id
         AND COALESCE(ts."organizationId", 0) <> COALESCE(u."organizationId", 0)`
    );
  } catch (err) {
    console.warn("Timesheet org backfill failed:", err?.message || err);
  }
};

const toCoordinate = (value, min, max) => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
};

const resolveRequestedUserId = async (client, organizationId, authUser, rawUserId) => {
  const authUserId = Number(authUser?.id);
  if (!Number.isInteger(authUserId) || authUserId <= 0) {
    return { error: "Unauthorized", statusCode: 401 };
  }

  const requestedUserId = Number(rawUserId);
  if (!Number.isInteger(requestedUserId) || requestedUserId <= 0 || requestedUserId === authUserId) {
    return { userId: authUserId };
  }

  if (!hasAnyRole(authUser, PRIVILEGED_ROLES)) {
    return { error: "Insufficient privileges.", statusCode: 403 };
  }

  const userRes = await client.query(
    `SELECT id
     FROM "user"
     WHERE id = $1 AND "organizationId" = $2
     LIMIT 1`,
    [requestedUserId, organizationId]
  );

  if (userRes.rowCount === 0) {
    return { error: "User not found.", statusCode: 404 };
  }

  return { userId: requestedUserId };
};

export async function handler(event = {}) {
  const method = (event.httpMethod || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return json(event, 204, {});
  }

  if (method !== "GET" && method !== "POST") {
    return json(event, 405, { error: "Method Not Allowed" });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const internal = await requireInternalUser(client, event, {
      methods: "GET,POST,OPTIONS",
    });
    if (internal.errorResponse) {
      return internal.errorResponse;
    }

    const { authUser, organizationId } = internal;
    await ensureTimesheetTable(client);

    let payload = {};
    if (method === "POST") {
      try {
        payload = JSON.parse(event.body || "{}");
      } catch {
        return json(event, 400, { error: "Invalid JSON body." });
      }
    }

    const userResolution = await resolveRequestedUserId(
      client,
      organizationId,
      authUser,
      method === "GET" ? event.queryStringParameters?.userId : payload.userId
    );
    if (userResolution.error) {
      return json(event, userResolution.statusCode || 400, { error: userResolution.error });
    }
    const userId = userResolution.userId;

    if (method === "GET") {
      const [activeRes, historyRes, weekRes, monthRes] = await Promise.all([
        client.query(
          `SELECT id, "organizationId", "userId", "clockIn", "clockOut", "clockInLat", "clockInLng", "clockOutLat", "clockOutLng"
           FROM "timesheet"
           WHERE "organizationId" = $1
             AND "userId" = $2
             AND "clockOut" IS NULL
           ORDER BY "clockIn" DESC
           LIMIT 1`,
          [organizationId, userId]
        ),
        client.query(
          `SELECT id, "organizationId", "userId", "clockIn", "clockOut", "clockInLat", "clockInLng", "clockOutLat", "clockOutLng"
           FROM "timesheet"
           WHERE "organizationId" = $1
             AND "userId" = $2
           ORDER BY "clockIn" DESC
           LIMIT 20`,
          [organizationId, userId]
        ),
        client.query(
          `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("clockOut" - "clockIn"))), 0) AS seconds,
                  COUNT(*)::int AS shifts
           FROM "timesheet"
           WHERE "organizationId" = $1
             AND "userId" = $2
             AND "clockOut" IS NOT NULL
             AND "clockIn" >= NOW() - INTERVAL '7 days'`,
          [organizationId, userId]
        ),
        client.query(
          `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("clockOut" - "clockIn"))), 0) AS seconds,
                  COUNT(*)::int AS shifts
           FROM "timesheet"
           WHERE "organizationId" = $1
             AND "userId" = $2
             AND "clockOut" IS NOT NULL
             AND "clockIn" >= NOW() - INTERVAL '30 days'`,
          [organizationId, userId]
        ),
      ]);

      const history = (historyRes.rows || []).map((row) => {
        let durationMinutes = null;
        if (row.clockOut) {
          const diffMs = new Date(row.clockOut).getTime() - new Date(row.clockIn).getTime();
          durationMinutes = diffMs > 0 ? Math.round(diffMs / 60000) : 0;
        }
        return { ...row, durationMinutes };
      });

      const weekSeconds = Number(weekRes.rows[0]?.seconds || 0);
      const monthSeconds = Number(monthRes.rows[0]?.seconds || 0);

      return json(event, 200, {
        activeShift: activeRes.rows[0] || null,
        history,
        totals: {
          weeklyHours: Number((weekSeconds / 3600).toFixed(2)),
          monthlyHours: Number((monthSeconds / 3600).toFixed(2)),
          weeklyShifts: Number(weekRes.rows[0]?.shifts || 0),
          monthlyShifts: Number(monthRes.rows[0]?.shifts || 0),
        },
      });
    }

    const lat = toCoordinate(payload.lat, -90, 90);
    const lng = toCoordinate(payload.lng, -180, 180);

    const activeRes = await client.query(
      `SELECT id, "clockIn"
       FROM "timesheet"
       WHERE "organizationId" = $1
         AND "userId" = $2
         AND "clockOut" IS NULL
       ORDER BY "clockIn" DESC
       LIMIT 1`,
      [organizationId, userId]
    );

    if (activeRes.rowCount > 0) {
      const activeShift = activeRes.rows[0];
      const clockOut = new Date();
      await client.query(
        `UPDATE "timesheet"
         SET "clockOut" = $1,
             "clockOutLat" = $2,
             "clockOutLng" = $3,
             "updatedAt" = NOW()
         WHERE id = $4
           AND "organizationId" = $5`,
        [clockOut.toISOString(), lat, lng, activeShift.id, organizationId]
      );

      return json(event, 200, { status: "out", id: activeShift.id });
    }

    const clockIn = new Date();
    const insertRes = await client.query(
      `INSERT INTO "timesheet"
        ("organizationId", "userId", "clockIn", "clockInLat", "clockInLng", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [organizationId, userId, clockIn.toISOString(), lat, lng]
    );

    return json(event, 200, { status: "in", id: insertRes.rows[0]?.id || null });
  } catch (err) {
    console.error("Timesheets error:", err);
    return json(event, 500, { error: "Failed to process timesheets." });
  } finally {
    await client.end().catch(() => {});
  }
}
