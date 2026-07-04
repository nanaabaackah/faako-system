ALTER TABLE "AccountingLedgerEntry"
ADD COLUMN "expenseClass" TEXT,
ADD COLUMN "counterparty" TEXT,
ADD COLUMN "dueDate" TIMESTAMP(3),
ADD COLUMN "paymentStatus" TEXT;

CREATE INDEX "AccountingLedgerEntry_expenseClass_idx"
ON "AccountingLedgerEntry"("expenseClass");

CREATE INDEX "AccountingLedgerEntry_paymentStatus_idx"
ON "AccountingLedgerEntry"("paymentStatus");

CREATE INDEX "AccountingLedgerEntry_dueDate_idx"
ON "AccountingLedgerEntry"("dueDate");
