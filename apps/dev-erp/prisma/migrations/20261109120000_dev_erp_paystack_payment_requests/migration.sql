-- Additive DEV ERP Paystack workflow records; no invoice ledger or historical records are modified.
CREATE TABLE "DevErpStandalonePaymentRequest" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdByUserId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT,
  "description" TEXT NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "requestedPesewas" BIGINT NOT NULL,
  "receivedPesewas" BIGINT NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DevErpStandalone_requested_positive" CHECK ("requestedPesewas" > 0),
  CONSTRAINT "DevErpStandalone_received_nonnegative" CHECK ("receivedPesewas" >= 0 AND "receivedPesewas" <= "requestedPesewas")
);
CREATE INDEX "DevErpStandalonePaymentRequest_organizationId_status_createdAt_idx"
  ON "DevErpStandalonePaymentRequest" ("organizationId", "status", "createdAt");

CREATE TABLE "DevErpPaystackPaymentIntent" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER NOT NULL REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdByUserId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  "reference" TEXT NOT NULL UNIQUE,
  "invoiceId" INTEGER REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "standalonePaymentId" INTEGER REFERENCES "DevErpStandalonePaymentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "customerEmail" TEXT NOT NULL,
  "amountPesewas" BIGINT NOT NULL,
  "currency" "CurrencyCode" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "checkoutUrl" TEXT,
  "providerVerifiedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DevErpIntent_positive_amount" CHECK ("amountPesewas" > 0),
  CONSTRAINT "DevErpIntent_valid_target" CHECK (
    ("type" = 'INVOICE' AND "invoiceId" IS NOT NULL AND "standalonePaymentId" IS NULL)
    OR ("type" = 'STANDALONE' AND "standalonePaymentId" IS NOT NULL AND "invoiceId" IS NULL)
  )
);
CREATE INDEX "DevErpPaystackPaymentIntent_organizationId_status_createdAt_idx"
  ON "DevErpPaystackPaymentIntent" ("organizationId", "status", "createdAt");
CREATE INDEX "DevErpPaystackPaymentIntent_organizationId_invoiceId_idx"
  ON "DevErpPaystackPaymentIntent" ("organizationId", "invoiceId");
CREATE INDEX "DevErpPaystackPaymentIntent_organizationId_standalonePaymentId_idx"
  ON "DevErpPaystackPaymentIntent" ("organizationId", "standalonePaymentId");

CREATE TABLE "DevErpPaystackProviderEvent" (
  "id" SERIAL PRIMARY KEY,
  "paymentIntentId" INTEGER NOT NULL REFERENCES "DevErpPaystackPaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "eventFingerprint" TEXT NOT NULL UNIQUE,
  "eventType" TEXT NOT NULL,
  "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "failureCode" TEXT
);
CREATE INDEX "DevErpPaystackProviderEvent_paymentIntentId_receivedAt_idx"
  ON "DevErpPaystackProviderEvent" ("paymentIntentId", "receivedAt");
