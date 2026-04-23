-- Add quotation flow: new statuses, view token, and response tracking on Invoice.

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'QUOTATION';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "viewToken"          TEXT,
  ADD COLUMN IF NOT EXISTS "viewTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "respondedAt"        TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_viewToken_key"
  ON "Invoice" ("viewToken");

CREATE INDEX IF NOT EXISTS "Invoice_viewToken_idx"
  ON "Invoice" ("viewToken");
