-- Phase 5 payment/webhook integrity. Review and apply per environment before
-- deploying code that requires these columns. This migration is not applied by
-- the Phase 5 implementation task.

ALTER TABLE "orderPayment"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "orderPayment_organizationId_idempotencyKey_key"
  ON "orderPayment" ("organizationId", "idempotencyKey");

CREATE TABLE IF NOT EXISTS "waterMomoWebhookEvent" (
  "id" BIGSERIAL PRIMARY KEY,
  "eventFingerprint" TEXT NOT NULL UNIQUE,
  "organizationId" INTEGER,
  "waterSaleId" INTEGER,
  "providerReference" TEXT,
  "paymentReference" TEXT,
  "paymentStatus" TEXT,
  "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "waterMomoWebhookEvent_org_received_idx"
  ON "waterMomoWebhookEvent" ("organizationId", "receivedAt");
