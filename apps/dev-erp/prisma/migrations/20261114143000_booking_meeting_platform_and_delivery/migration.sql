-- Preserve all existing and Google-synced appointments.
-- New meeting provider and delivery metadata are nullable/additive.
ALTER TABLE "Booking"
  ADD COLUMN "meetingPlatform" TEXT,
  ADD COLUMN "meetingLinkSentAt" TIMESTAMP(3),
  ADD COLUMN "meetingLinkDeliveryStatus" TEXT NOT NULL DEFAULT 'NOT_SENT';
