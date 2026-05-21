-- Add webhook confirmation metadata for Stroane Paystack payment handling.
-- The webhook remains the trusted payment confirmation source; browser return
-- verification is only a customer-facing status check.
ALTER TABLE "CommerceOrder"
ADD COLUMN "paymentConfirmationSource" TEXT,
ADD COLUMN "paymentWebhookEvent" TEXT,
ADD COLUMN "paymentWebhookReference" TEXT,
ADD COLUMN "paymentWebhookProcessedAt" TIMESTAMP(3),
ADD COLUMN "paymentWebhookMetadata" JSONB;

CREATE INDEX "CommerceOrder_paymentWebhookReference_idx"
ON "CommerceOrder"("paymentWebhookReference");
