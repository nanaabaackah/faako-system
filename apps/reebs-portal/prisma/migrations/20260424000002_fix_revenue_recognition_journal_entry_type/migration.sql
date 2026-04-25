DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'revenueRecognitionLine'
      AND column_name = 'journalEntryId'
      AND data_type <> 'integer'
  ) THEN
    ALTER TABLE "revenueRecognitionLine"
      ALTER COLUMN "journalEntryId" TYPE INTEGER
      USING (
        CASE
          WHEN "journalEntryId" IS NULL THEN NULL
          WHEN BTRIM("journalEntryId"::text) ~ '^[0-9]+$' THEN BTRIM("journalEntryId"::text)::INTEGER
          ELSE NULL
        END
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "revenueRecognitionLine_journalEntryId_idx"
  ON "revenueRecognitionLine" ("journalEntryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'revenueRecognitionLine_journalEntryId_fkey'
  ) THEN
    ALTER TABLE "revenueRecognitionLine"
      ADD CONSTRAINT "revenueRecognitionLine_journalEntryId_fkey"
      FOREIGN KEY ("journalEntryId") REFERENCES "journalEntry" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
