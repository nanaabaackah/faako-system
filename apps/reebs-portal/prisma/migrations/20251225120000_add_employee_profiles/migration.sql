-- Create employee profile table for HR data
CREATE TABLE IF NOT EXISTS "employeeProfile" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "jobTitle" TEXT,
  "phone" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactPhone" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "employeeProfile_userId_key" ON "employeeProfile" ("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employeeProfile_userId_fkey'
  ) THEN
    ALTER TABLE "employeeProfile"
      ADD CONSTRAINT "employeeProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "user"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
