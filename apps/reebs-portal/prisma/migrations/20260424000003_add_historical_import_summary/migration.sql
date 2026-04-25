ALTER TABLE "historicalImportBatch"
  ADD COLUMN IF NOT EXISTS "summary" JSONB;
