CREATE TYPE "AccountingLedgerEntryType" AS ENUM (
  'INCOME',
  'EXPENSE',
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'ADJUSTMENT'
);

CREATE TABLE "AccountingLedgerEntry" (
  "id" TEXT NOT NULL,
  "entryType" "AccountingLedgerEntryType" NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "entryDate" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'manual_lump_sum',
  "reference" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountingLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccountingLedgerEntry_entryType_entryDate_idx"
ON "AccountingLedgerEntry"("entryType", "entryDate");

CREATE INDEX "AccountingLedgerEntry_status_entryDate_idx"
ON "AccountingLedgerEntry"("status", "entryDate");

CREATE INDEX "AccountingLedgerEntry_category_idx"
ON "AccountingLedgerEntry"("category");

CREATE INDEX "AccountingLedgerEntry_createdAt_idx"
ON "AccountingLedgerEntry"("createdAt");
