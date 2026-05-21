-- Lightweight Stroane admin order-management fields.
-- These fields are operational placeholders only; they do not implement
-- inventory deduction, delivery logistics, payment mutation, or fulfillment automation.

ALTER TABLE "CommerceOrder"
ADD COLUMN "fulfillmentStatus" TEXT,
ADD COLUMN "deliveryMethod" TEXT,
ADD COLUMN "expectedDeliveryDate" TIMESTAMP(3),
ADD COLUMN "adminDeliveryNotes" TEXT,
ADD COLUMN "internalNotes" TEXT,
ADD COLUMN "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN "statusUpdatedById" TEXT;

CREATE INDEX "CommerceOrder_fulfillmentStatus_idx"
ON "CommerceOrder"("fulfillmentStatus");

CREATE INDEX "CommerceOrder_statusUpdatedAt_idx"
ON "CommerceOrder"("statusUpdatedAt");
