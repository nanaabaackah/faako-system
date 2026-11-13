-- Add opt-in assumed-autopay accounting projections; do not modify any existing payment entries.
ALTER TABLE "AccountingEntry"
  ADD COLUMN "autopayEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recurrenceAnchorAt" TIMESTAMP(3),
  ADD COLUMN "recurrenceParentId" INTEGER,
  ADD COLUMN "recurrencePeriodAt" TIMESTAMP(3);

CREATE INDEX "AccountingEntry_autopayEnabled_recurringInterval_idx"
  ON "AccountingEntry"("autopayEnabled", "recurringInterval");
CREATE UNIQUE INDEX "AccountingEntry_recurrenceParentId_recurrencePeriodAt_key"
  ON "AccountingEntry"("recurrenceParentId", "recurrencePeriodAt");
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_recurrenceParentId_fkey"
  FOREIGN KEY ("recurrenceParentId") REFERENCES "AccountingEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
