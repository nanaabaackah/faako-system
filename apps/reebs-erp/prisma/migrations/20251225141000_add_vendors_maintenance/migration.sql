-- Vendor directory and maintenance logs
CREATE TABLE IF NOT EXISTS "vendor" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "bankName" TEXT,
  "bankAccount" TEXT,
  "leadTimeDays" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "vendorId" INTEGER;
CREATE INDEX IF NOT EXISTS "product_vendorId_idx" ON "product" ("vendorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_vendorId_fkey'
  ) THEN
    ALTER TABLE "product"
      ADD CONSTRAINT "product_vendorId_fkey"
      FOREIGN KEY ("vendorId") REFERENCES "vendor"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "maintenanceLog" (
  "id" SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL,
  "issue" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "cost" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'open',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "maintenanceLog_productId_idx" ON "maintenanceLog" ("productId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'maintenanceLog_productId_fkey'
  ) THEN
    ALTER TABLE "maintenanceLog"
      ADD CONSTRAINT "maintenanceLog_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "product"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
