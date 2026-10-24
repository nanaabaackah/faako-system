CREATE TYPE "PaymentIntentType" AS ENUM ('INVOICE', 'STANDALONE');
CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'INITIALIZING', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELED');
CREATE TYPE "StandalonePaymentStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELED', 'EXPIRED');
CREATE TYPE "PaymentProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TYPE "PaymentReceiptDeliveryStatus" AS ENUM ('NOT_SENT', 'SENT', 'FAILED');

CREATE TABLE "StandalonePayment" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "customerReference" TEXT,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT,
  "description" TEXT NOT NULL,
  "internalReference" TEXT,
  "internalNotes" TEXT,
  "creationKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "expectedMinor" INTEGER NOT NULL,
  "receivedMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'GHS',
  "status" "StandalonePaymentStatus" NOT NULL DEFAULT 'DRAFT',
  "dueAt" DATE,
  "canceledAt" TIMESTAMP(3),
  "reconciledInvoiceId" INTEGER,
  "reconciledAt" TIMESTAMP(3),
  "reconciledByUserId" INTEGER,
  "createdByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StandalonePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StandalonePayment_amounts_check" CHECK ("expectedMinor" > 0 AND "receivedMinor" >= 0 AND "receivedMinor" <= "expectedMinor")
);

CREATE TABLE "PaymentIntent" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "type" "PaymentIntentType" NOT NULL,
  "invoiceId" INTEGER,
  "standalonePaymentId" INTEGER,
  "invoicePaymentId" INTEGER,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "currency" "CurrencyCode" NOT NULL DEFAULT 'GHS',
  "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  "providerReference" TEXT NOT NULL,
  "checkoutUrl" TEXT,
  "publicTokenHash" TEXT NOT NULL,
  "initializationKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3),
  "initializedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCategory" TEXT,
  "providerTransactionId" TEXT,
  "providerChannel" TEXT,
  "providerPaidAt" TIMESTAMP(3),
  "linkDeliveryStatus" "PaymentReceiptDeliveryStatus" NOT NULL DEFAULT 'NOT_SENT',
  "linkSentTo" TEXT,
  "linkSentAt" TIMESTAMP(3),
  "linkDeliveryFailure" TEXT,
  "createdByUserId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentIntent_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "PaymentIntent_target_check" CHECK (("type" = 'INVOICE' AND "invoiceId" IS NOT NULL AND "standalonePaymentId" IS NULL) OR ("type" = 'STANDALONE' AND "standalonePaymentId" IS NOT NULL AND "invoiceId" IS NULL))
);

CREATE TABLE "PaymentProviderEvent" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "paymentIntentId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
  "eventFingerprint" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "PaymentProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "failureCategory" TEXT,
  CONSTRAINT "PaymentProviderEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentLinkDelivery" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "paymentIntentId" INTEGER NOT NULL,
  "recipient" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "status" "PaymentReceiptDeliveryStatus" NOT NULL DEFAULT 'NOT_SENT',
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCategory" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentLinkDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentReceipt" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "paymentIntentId" INTEGER NOT NULL,
  "standalonePaymentId" INTEGER,
  "receiptNumber" TEXT NOT NULL,
  "publicTokenHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveryStatus" "PaymentReceiptDeliveryStatus" NOT NULL DEFAULT 'NOT_SENT',
  "sentTo" TEXT,
  "sentAt" TIMESTAMP(3),
  "deliveryFailure" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StandalonePayment_organizationId_internalReference_key" ON "StandalonePayment"("organizationId", "internalReference");
CREATE UNIQUE INDEX "StandalonePayment_organizationId_creationKey_key" ON "StandalonePayment"("organizationId", "creationKey");
CREATE INDEX "StandalonePayment_organizationId_status_createdAt_idx" ON "StandalonePayment"("organizationId", "status", "createdAt");
CREATE INDEX "StandalonePayment_organizationId_customerEmail_idx" ON "StandalonePayment"("organizationId", "customerEmail");
CREATE INDEX "StandalonePayment_organizationId_dueAt_idx" ON "StandalonePayment"("organizationId", "dueAt");
CREATE INDEX "StandalonePayment_organizationId_reconciledInvoiceId_idx" ON "StandalonePayment"("organizationId", "reconciledInvoiceId");
CREATE UNIQUE INDEX "PaymentIntent_invoicePaymentId_key" ON "PaymentIntent"("invoicePaymentId");
CREATE UNIQUE INDEX "PaymentIntent_providerReference_key" ON "PaymentIntent"("providerReference");
CREATE UNIQUE INDEX "PaymentIntent_providerTransactionId_key" ON "PaymentIntent"("providerTransactionId");
CREATE UNIQUE INDEX "PaymentIntent_publicTokenHash_key" ON "PaymentIntent"("publicTokenHash");
CREATE UNIQUE INDEX "PaymentIntent_organizationId_initializationKey_key" ON "PaymentIntent"("organizationId", "initializationKey");
CREATE INDEX "PaymentIntent_organizationId_type_status_createdAt_idx" ON "PaymentIntent"("organizationId", "type", "status", "createdAt");
CREATE INDEX "PaymentIntent_organizationId_invoiceId_createdAt_idx" ON "PaymentIntent"("organizationId", "invoiceId", "createdAt");
CREATE INDEX "PaymentIntent_organizationId_standalonePaymentId_createdAt_idx" ON "PaymentIntent"("organizationId", "standalonePaymentId", "createdAt");
CREATE INDEX "PaymentIntent_provider_status_updatedAt_idx" ON "PaymentIntent"("provider", "status", "updatedAt");
CREATE UNIQUE INDEX "PaymentLinkDelivery_organizationId_idempotencyKey_key" ON "PaymentLinkDelivery"("organizationId", "idempotencyKey");
CREATE INDEX "PaymentLinkDelivery_paymentIntentId_createdAt_idx" ON "PaymentLinkDelivery"("paymentIntentId", "createdAt");
CREATE INDEX "PaymentLinkDelivery_organizationId_status_createdAt_idx" ON "PaymentLinkDelivery"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "PaymentProviderEvent_eventFingerprint_key" ON "PaymentProviderEvent"("eventFingerprint");
CREATE INDEX "PaymentProviderEvent_organizationId_status_receivedAt_idx" ON "PaymentProviderEvent"("organizationId", "status", "receivedAt");
CREATE INDEX "PaymentProviderEvent_paymentIntentId_receivedAt_idx" ON "PaymentProviderEvent"("paymentIntentId", "receivedAt");
CREATE UNIQUE INDEX "PaymentReceipt_paymentIntentId_key" ON "PaymentReceipt"("paymentIntentId");
CREATE UNIQUE INDEX "PaymentReceipt_receiptNumber_key" ON "PaymentReceipt"("receiptNumber");
CREATE UNIQUE INDEX "PaymentReceipt_publicTokenHash_key" ON "PaymentReceipt"("publicTokenHash");
CREATE INDEX "PaymentReceipt_organizationId_issuedAt_idx" ON "PaymentReceipt"("organizationId", "issuedAt");
CREATE INDEX "PaymentReceipt_standalonePaymentId_issuedAt_idx" ON "PaymentReceipt"("standalonePaymentId", "issuedAt");

ALTER TABLE "StandalonePayment" ADD CONSTRAINT "StandalonePayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StandalonePayment" ADD CONSTRAINT "StandalonePayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StandalonePayment" ADD CONSTRAINT "StandalonePayment_reconciledInvoiceId_fkey" FOREIGN KEY ("reconciledInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StandalonePayment" ADD CONSTRAINT "StandalonePayment_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_standalonePaymentId_fkey" FOREIGN KEY ("standalonePaymentId") REFERENCES "StandalonePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_invoicePaymentId_fkey" FOREIGN KEY ("invoicePaymentId") REFERENCES "InvoicePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentLinkDelivery" ADD CONSTRAINT "PaymentLinkDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentLinkDelivery" ADD CONSTRAINT "PaymentLinkDelivery_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentProviderEvent" ADD CONSTRAINT "PaymentProviderEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_standalonePaymentId_fkey" FOREIGN KEY ("standalonePaymentId") REFERENCES "StandalonePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
