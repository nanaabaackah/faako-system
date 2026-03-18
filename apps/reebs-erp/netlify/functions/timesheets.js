/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "timesheet" (
    "id" SERIAL PRIMARY KEY,
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
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockOut" TIMESTAMPTZ`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockInLat" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockInLng" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockOutLat" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "clockOutLng" DOUBLE PRECISION`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "timesheet" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE INDEX IF NOT EXISTS "timesheet_userId_idx" ON "timesheet" ("userId")`,
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
];

const ensureTimesheetTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Timesheet table check failed:", err?.message || err);
    }
  }
};

const parseUserId = (event) => {
  const headers = event?.headers || {};
  const raw =
    headers["x-user-id"] ||
    headers["X-User-Id"] ||
    headers["x-userid"] ||
    headers["x_user_id"] ||
    event?.queryStringParameters?.userId;
  const userId = Number(raw);
  return Number.isFinite(userId) ? userId : null;
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      },
      body: "",
    };
  }

  const userId = parseUserId(event);
  if (!userId) {
    return json(400, { error: "userId is required." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureTimesheetTable(client);

    if (event.httpMethod === "GET") {
      const [activeRes, historyRes, weekRes, monthRes] = await Promise.all([
        client.query(
          `SELECT id, "userId", "clockIn", "clockOut", "clockInLat", "clockInLng", "clockOutLat", "clockOutLng"
           FROM "timesheet"
           WHERE "userId" = $1 AND "clockOut" IS NULL
           ORDER BY "clockIn" DESC
           LIMIT 1`,
          [userId]
        ),
        client.query(
          `SELECT id, "userId", "clockIn", "clockOut", "clockInLat", "clockInLng", "clockOutLat", "clockOutLng"
           FROM "timesheet"
           WHERE "userId" = $1
           ORDER BY "clockIn" DESC
           LIMIT 20`,
          [userId]
        ),
        client.query(
          `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("clockOut" - "clockIn"))), 0) AS seconds,
                  COUNT(*)::int AS shifts
           FROM "timesheet"
           WHERE "userId" = $1
             AND "clockOut" IS NOT NULL
             AND "clockIn" >= NOW() - INTERVAL '7 days'`,
          [userId]
        ),
        client.query(
          `SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("clockOut" - "clockIn"))), 0) AS seconds,
                  COUNT(*)::int AS shifts
           FROM "timesheet"
           WHERE "userId" = $1
             AND "clockOut" IS NOT NULL
             AND "clockIn" >= NOW() - INTERVAL '30 days'`,
          [userId]
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

      return json(200, {
        activeShift: activeRes.rows[0] || null,
        history,
        totals: {
          weeklyHours: Number((weekSeconds / 3600).toFixed(2)),
          monthlyHours: Number((monthSeconds / 3600).toFixed(2)),
          weeklyShifts: weekRes.rows[0]?.shifts || 0,
          monthlyShifts: monthRes.rows[0]?.shifts || 0,
        },
      });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method Not Allowed" });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    const lat = toNumber(payload.lat);
    const lng = toNumber(payload.lng);

    const activeRes = await client.query(
      `SELECT id, "clockIn"
       FROM "timesheet"
       WHERE "userId" = $1 AND "clockOut" IS NULL
       ORDER BY "clockIn" DESC
       LIMIT 1`,
      [userId]
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
         WHERE id = $4`,
        [clockOut.toISOString(), lat, lng, activeShift.id]
      );

      return json(200, { status: "out", id: activeShift.id });
    }

    const clockIn = new Date();
    const insertRes = await client.query(
      `INSERT INTO "timesheet"
        ("userId", "clockIn", "clockInLat", "clockInLng", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id`,
      [userId, clockIn.toISOString(), lat, lng]
    );

    return json(200, { status: "in", id: insertRes.rows[0]?.id || null });
  } catch (err) {
    console.error("❌ Timesheets error:", err);
    return json(500, { error: "Failed to process timesheets." });
  } finally {
    await client.end().catch(() => {});
  }
}
