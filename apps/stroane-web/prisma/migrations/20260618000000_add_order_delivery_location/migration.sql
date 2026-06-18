-- Add optional selected/geocoded delivery location metadata for checkout orders.
ALTER TABLE "CommerceOrder"
  ADD COLUMN "deliveryPlaceId" TEXT,
  ADD COLUMN "deliveryLocationLabel" TEXT,
  ADD COLUMN "deliveryLocationProvider" TEXT,
  ADD COLUMN "deliveryLatitude" DECIMAL(10, 7),
  ADD COLUMN "deliveryLongitude" DECIMAL(10, 7),
  ADD COLUMN "deliveryMapUrl" TEXT;

CREATE INDEX "CommerceOrder_deliveryPlaceId_idx" ON "CommerceOrder"("deliveryPlaceId");
