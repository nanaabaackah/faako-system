-- Add customer-safe order notification metadata for Stroane checkout.
-- This is an additive foundation only; detailed notification logs/audits should
-- be added later before multi-channel automation.
ALTER TABLE "CommerceOrder"
ADD COLUMN "preferredContactMethod" TEXT,
ADD COLUMN "customerNotificationStatus" TEXT,
ADD COLUMN "customerNotificationType" TEXT,
ADD COLUMN "customerNotificationSentAt" TIMESTAMP(3),
ADD COLUMN "customerNotificationProviderId" TEXT,
ADD COLUMN "customerNotificationError" TEXT;

CREATE INDEX "CommerceOrder_customerNotificationStatus_idx"
ON "CommerceOrder"("customerNotificationStatus");
