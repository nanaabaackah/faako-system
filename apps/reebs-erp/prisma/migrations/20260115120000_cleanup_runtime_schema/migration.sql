-- Align schema with runtime DDL safeguards.

-- Order delivery details + audit columns.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryDetails" JSONB;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "pickupDetails" JSONB;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "lastModifiedAt" TIMESTAMPTZ DEFAULT NOW();

-- Booking audit columns.
ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "createdByUserId" INTEGER;
ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "updatedByUserId" INTEGER;
ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "lastModifiedAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Product status + audit columns.
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT false;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMPTZ;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "archivedByUserId" INTEGER;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN DEFAULT false;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "deletedByUserId" INTEGER;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "lastUpdatedByUserId" INTEGER;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "lastUpdatedAt" TIMESTAMPTZ DEFAULT NOW();

-- Stock movement audit columns.
ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "performedByUserId" INTEGER;
ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "performedByName" TEXT;
ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "performedByEmail" TEXT;
ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "stockMovement" ADD COLUMN IF NOT EXISTS "soldMonth" DATE;

-- Delivery table.
CREATE TABLE IF NOT EXISTS "delivery" (
  "id" SERIAL PRIMARY KEY,
  "bookingId" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "driverName" TEXT,
  "routeGroup" TEXT,
  "routeOrder" INTEGER,
  "eta" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled';
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "driverName" TEXT;
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "routeGroup" TEXT;
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "routeOrder" INTEGER;
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "eta" TEXT;
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_bookingId_key" ON "delivery" ("bookingId");
CREATE INDEX IF NOT EXISTS "delivery_status_idx" ON "delivery" ("status");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_bookingId_fkey'
  ) THEN
    ALTER TABLE "delivery"
      ADD CONSTRAINT "delivery_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "booking"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Manager device tokens.
CREATE TABLE IF NOT EXISTS "managerDevice" (
  "id" SERIAL PRIMARY KEY,
  "token" TEXT NOT NULL UNIQUE,
  "platform" TEXT,
  "deviceId" TEXT,
  "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "token" TEXT NOT NULL;
ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "managerDevice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS "managerDevice_token_key" ON "managerDevice" ("token");
