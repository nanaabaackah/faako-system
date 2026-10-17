-- Phase 6 immutable invoice payment ledger.
-- Additive only. Existing Invoice.paidAmount values remain untouched and are
-- captured as a legacy opening balance only when the new ledger is activated.

CREATE TYPE "InvoicePaymentMethod" AS ENUM (
  'MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'CARD_GATEWAY', 'OTHER'
);

CREATE TYPE "PaymentVerificationStatus" AS ENUM (
  'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REVERSED'
);

CREATE TYPE "PaymentLedgerEntryType" AS ENUM (
  'PAYMENT', 'REVERSAL', 'CORRECTION', 'REFUND', 'RECONCILIATION_ADJUSTMENT'
);

CREATE TYPE "PaymentLedgerEntryStatus" AS ENUM ('POSTED');

CREATE TYPE "PaymentOperationType" AS ENUM (
  'RECORD', 'VERIFY', 'REJECT', 'REVERSE', 'ADJUST'
);

ALTER TABLE "Invoice"
  ADD COLUMN "legacyPaidAmount" DECIMAL(14,2),
  ADD COLUMN "paymentLedgerActivatedAt" TIMESTAMP(3);

CREATE TABLE "InvoicePayment" (
  "id" SERIAL NOT NULL,
  "transactionId" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "invoiceId" INTEGER NOT NULL,
  "customerName" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "method" "InvoicePaymentMethod" NOT NULL,
  "provider" TEXT,
  "externalReference" TEXT,
  "externalReferenceKey" TEXT,
  "paymentDate" DATE NOT NULL,
  "verificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "evidenceUrl" TEXT,
  "note" TEXT,
  "recordedByUserId" INTEGER NOT NULL,
  "verifiedByUserId" INTEGER,
  "verifiedAt" TIMESTAMP(3),
  "rejectedByUserId" INTEGER,
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "reversedAt" TIMESTAMP(3),
  "correctsPaymentId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoicePaymentLedgerEntry" (
  "id" SERIAL NOT NULL,
  "transactionId" TEXT NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "invoiceId" INTEGER NOT NULL,
  "paymentId" INTEGER,
  "entryType" "PaymentLedgerEntryType" NOT NULL,
  "status" "PaymentLedgerEntryStatus" NOT NULL DEFAULT 'POSTED',
  "signedAmount" DECIMAL(14,2) NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "method" "InvoicePaymentMethod",
  "externalReference" TEXT,
  "effectiveAt" DATE NOT NULL,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" INTEGER NOT NULL,
  "reversesEntryId" INTEGER,
  "reason" TEXT,
  "metadata" JSONB,
  CONSTRAINT "InvoicePaymentLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentIdempotencyClaim" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "invoiceId" INTEGER NOT NULL,
  "operation" "PaymentOperationType" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "paymentId" INTEGER,
  "ledgerEntryId" INTEGER,
  "responseSnapshot" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentIdempotencyClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoicePayment_transactionId_key" ON "InvoicePayment"("transactionId");
CREATE UNIQUE INDEX "InvoicePayment_organizationId_externalReferenceKey_key" ON "InvoicePayment"("organizationId", "externalReferenceKey");
CREATE INDEX "InvoicePayment_organizationId_invoiceId_createdAt_idx" ON "InvoicePayment"("organizationId", "invoiceId", "createdAt");
CREATE INDEX "InvoicePayment_organizationId_verificationStatus_createdAt_idx" ON "InvoicePayment"("organizationId", "verificationStatus", "createdAt");
CREATE INDEX "InvoicePayment_invoiceId_paymentDate_idx" ON "InvoicePayment"("invoiceId", "paymentDate");
CREATE INDEX "InvoicePayment_correctsPaymentId_idx" ON "InvoicePayment"("correctsPaymentId");

CREATE UNIQUE INDEX "InvoicePaymentLedgerEntry_transactionId_key" ON "InvoicePaymentLedgerEntry"("transactionId");
CREATE UNIQUE INDEX "InvoicePaymentLedgerEntry_paymentId_entryType_key" ON "InvoicePaymentLedgerEntry"("paymentId", "entryType");
CREATE UNIQUE INDEX "InvoicePaymentLedgerEntry_reversesEntryId_key" ON "InvoicePaymentLedgerEntry"("reversesEntryId");
CREATE INDEX "InvoicePaymentLedgerEntry_organizationId_invoiceId_postedAt_idx" ON "InvoicePaymentLedgerEntry"("organizationId", "invoiceId", "postedAt");
CREATE INDEX "InvoicePaymentLedgerEntry_invoiceId_effectiveAt_idx" ON "InvoicePaymentLedgerEntry"("invoiceId", "effectiveAt");
CREATE INDEX "InvoicePaymentLedgerEntry_paymentId_idx" ON "InvoicePaymentLedgerEntry"("paymentId");

CREATE UNIQUE INDEX "PaymentIdempotencyClaim_organizationId_operation_idempotencyKey_key"
  ON "PaymentIdempotencyClaim"("organizationId", "operation", "idempotencyKey");
CREATE INDEX "PaymentIdempotencyClaim_invoiceId_createdAt_idx" ON "PaymentIdempotencyClaim"("invoiceId", "createdAt");
CREATE INDEX "PaymentIdempotencyClaim_paymentId_idx" ON "PaymentIdempotencyClaim"("paymentId");

ALTER TABLE "InvoicePayment"
  ADD CONSTRAINT "InvoicePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePayment_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePayment_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePayment_correctsPaymentId_fkey" FOREIGN KEY ("correctsPaymentId") REFERENCES "InvoicePayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoicePaymentLedgerEntry"
  ADD CONSTRAINT "InvoicePaymentLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePaymentLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePaymentLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "InvoicePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePaymentLedgerEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InvoicePaymentLedgerEntry_reversesEntryId_fkey" FOREIGN KEY ("reversesEntryId") REFERENCES "InvoicePaymentLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentIdempotencyClaim"
  ADD CONSTRAINT "PaymentIdempotencyClaim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentIdempotencyClaim_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentIdempotencyClaim_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "InvoicePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentIdempotencyClaim_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "InvoicePaymentLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Posted financial entries are append-only. Workflow state lives on
-- InvoicePayment and projections live on Invoice/AccountingEntry.
CREATE FUNCTION "prevent_invoice_payment_ledger_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Invoice payment ledger entries are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "InvoicePaymentLedgerEntry_no_update"
  BEFORE UPDATE ON "InvoicePaymentLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "prevent_invoice_payment_ledger_mutation"();

CREATE TRIGGER "InvoicePaymentLedgerEntry_no_delete"
  BEFORE DELETE ON "InvoicePaymentLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION "prevent_invoice_payment_ledger_mutation"();
