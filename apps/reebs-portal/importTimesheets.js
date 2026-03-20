/* eslint-disable no-undef */
import { resolvePgSslConfig } from "./runtimeEnv.js";
import fs from "fs";
import Papa from "papaparse";
import { Client } from "pg";

const shouldReset = process.env.IMPORT_RESET === "true";

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

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const toDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

async function importTimesheets() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureTimesheetTable(client);

    if (shouldReset) {
      await client.query(`TRUNCATE TABLE "timesheet" RESTART IDENTITY CASCADE`);
      console.log("🔄 Cleared timesheets.");
    }

    const file = fs.readFileSync("data/timesheets.csv", "utf8");
    const { data } = Papa.parse(file, { header: true, skipEmptyLines: true });

    const userRows = await client.query(`SELECT id FROM "user"`);
    const userIds = new Set(userRows.rows.map((row) => row.id));

    let inserted = 0;

    for (const row of data) {
      const userId = Number(row.userId);
      if (!Number.isFinite(userId) || !userIds.has(userId)) continue;

      const clockIn = toDate(row.clockIn);
      const clockOut = toDate(row.clockOut);
      if (!clockIn) continue;

      await client.query(
        `INSERT INTO "timesheet"
          ("userId", "clockIn", "clockOut", "clockInLat", "clockInLng", "clockOutLat", "clockOutLng", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          userId,
          clockIn.toISOString(),
          clockOut ? clockOut.toISOString() : null,
          toNumber(row.clockInLat),
          toNumber(row.clockInLng),
          toNumber(row.clockOutLat),
          toNumber(row.clockOutLng),
        ]
      );
      inserted += 1;
    }

    console.log(`✅ Imported ${inserted} timesheet records.`);
  } catch (err) {
    console.error("❌ Timesheet import failed:", err);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

importTimesheets();
