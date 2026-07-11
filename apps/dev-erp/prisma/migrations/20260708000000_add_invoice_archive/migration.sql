-- Add soft archive support for invoice ledger cleanup and bulk actions.
ALTER TABLE "Invoice"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Invoice_organizationId_archivedAt_idx" ON "Invoice"("organizationId", "archivedAt");
