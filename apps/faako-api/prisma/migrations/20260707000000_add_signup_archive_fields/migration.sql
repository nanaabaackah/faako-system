ALTER TABLE "SignupRequest"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;

CREATE INDEX IF NOT EXISTS "SignupRequest_archivedAt_idx"
  ON "SignupRequest"("archivedAt");
