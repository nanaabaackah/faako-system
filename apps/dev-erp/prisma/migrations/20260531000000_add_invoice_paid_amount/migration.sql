-- Additive invoice settlement tracking for manual partial-payment support.
ALTER TABLE "Invoice"
ADD COLUMN "paidAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Preserve the meaning of existing paid invoices.
UPDATE "Invoice"
SET "paidAmount" = "total"
WHERE "status" = 'PAID';
