-- Bookings & Rentals integrity foundation.
--
-- Additive snapshot and operational fields only. Existing booking totals and
-- item prices are preserved exactly; no historical amount is recalculated.

ALTER TABLE "booking"
  ADD COLUMN "reference" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "eventEndDate" TIMESTAMP(3),
  ADD COLUMN "venueGhanaPostGps" TEXT,
  ADD COLUMN "customerNotes" TEXT,
  ADD COLUMN "internalNotes" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GHS',
  ADD COLUMN "subtotalCents" INTEGER,
  ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taxCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "depositRateBps" INTEGER,
  ADD COLUMN "depositRequiredCents" INTEGER;

UPDATE "booking"
SET
  "reference" = 'RB-' || EXTRACT(YEAR FROM "createdAt")::int::text || '-' || LPAD(id::text, 6, '0'),
  "eventEndDate" = "eventDate",
  "subtotalCents" = "totalAmount"
WHERE "reference" IS NULL
   OR "eventEndDate" IS NULL
   OR "subtotalCents" IS NULL;

ALTER TABLE "booking"
  ALTER COLUMN "reference" SET NOT NULL,
  ALTER COLUMN "eventEndDate" SET NOT NULL,
  ALTER COLUMN "subtotalCents" SET NOT NULL,
  ADD CONSTRAINT "booking_date_range_check" CHECK ("eventEndDate"::date >= "eventDate"::date) NOT VALID,
  ADD CONSTRAINT "booking_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "booking_money_snapshot_check" CHECK (
    "subtotalCents" >= 0
    AND "discountCents" >= 0
    AND "feeCents" >= 0
    AND "taxCents" >= 0
    AND "totalAmount" >= 0
    AND ("depositRequiredCents" IS NULL OR "depositRequiredCents" >= 0)
  ) NOT VALID,
  ADD CONSTRAINT "booking_deposit_rate_check" CHECK (
    "depositRateBps" IS NULL OR ("depositRateBps" >= 0 AND "depositRateBps" <= 10000)
  ) NOT VALID;

CREATE UNIQUE INDEX "booking_organizationId_reference_key"
  ON "booking" ("organizationId", "reference");

CREATE UNIQUE INDEX "booking_organizationId_idempotencyKey_key"
  ON "booking" ("organizationId", "idempotencyKey");

CREATE INDEX "booking_org_event_window_status_idx"
  ON "booking" ("organizationId", "eventDate", "eventEndDate", status);

ALTER TABLE "bookingItem"
  ADD COLUMN "catalogPrice" INTEGER,
  ADD COLUMN "priceOverride" INTEGER,
  ADD COLUMN "priceOverriddenByUserId" INTEGER,
  ADD COLUMN "priceOverriddenAt" TIMESTAMP(3),
  ADD COLUMN "lineTotal" INTEGER;

UPDATE "bookingItem"
SET
  "catalogPrice" = price,
  "lineTotal" = price * quantity
WHERE "catalogPrice" IS NULL OR "lineTotal" IS NULL;

ALTER TABLE "bookingItem"
  ALTER COLUMN "lineTotal" SET NOT NULL,
  ADD CONSTRAINT "bookingItem_quantity_check" CHECK (quantity > 0) NOT VALID,
  ADD CONSTRAINT "bookingItem_price_snapshot_check" CHECK (
    price >= 0
    AND ("catalogPrice" IS NULL OR "catalogPrice" >= 0)
    AND ("priceOverride" IS NULL OR "priceOverride" >= 0)
    AND "lineTotal" = price * quantity
  ) NOT VALID;
