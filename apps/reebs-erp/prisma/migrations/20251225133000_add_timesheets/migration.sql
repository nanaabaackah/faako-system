-- Timesheets table for clock in/out tracking
CREATE TABLE IF NOT EXISTS "timesheet" (
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
);

CREATE INDEX IF NOT EXISTS "timesheet_userId_idx" ON "timesheet" ("userId");

DO $$
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
END $$;
