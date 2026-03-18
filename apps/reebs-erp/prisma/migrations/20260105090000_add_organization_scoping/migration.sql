-- CreateTable
CREATE TABLE "organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

INSERT INTO "organization" ("id", "name", "createdAt", "updatedAt")
VALUES (1, 'Default Organization', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

SELECT setval(pg_get_serial_sequence('"organization"', 'id'), (SELECT MAX("id") FROM "organization"));

-- Add organizationId columns
ALTER TABLE "order" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "order" ADD CONSTRAINT "order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orderItem" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "orderItem" ADD CONSTRAINT "orderItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "product" ADD CONSTRAINT "product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stockMovement" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "stockMovement" ADD CONSTRAINT "stockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "user" ADD CONSTRAINT "user_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employeeProfile" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "employeeProfile" ADD CONSTRAINT "employeeProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "document" ADD CONSTRAINT "document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "vendor" ADD CONSTRAINT "vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenanceLog" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "maintenanceLog" ADD CONSTRAINT "maintenanceLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "timesheet" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "timesheet" ADD CONSTRAINT "timesheet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "expense" ADD CONSTRAINT "expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "discount" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "discount" ADD CONSTRAINT "discount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "customer" ADD CONSTRAINT "customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "booking" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "booking" ADD CONSTRAINT "booking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bookingItem" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "bookingItem" ADD CONSTRAINT "bookingItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bouncy_castles" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "bouncy_castles" ADD CONSTRAINT "bouncy_castles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "indoor_games" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "indoor_games" ADD CONSTRAINT "indoor_games_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "machines" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "machines" ADD CONSTRAINT "machines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shop_items" ADD COLUMN "organizationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update unique indexes to be organization-scoped
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "order_orderNumber_key";
DROP INDEX IF EXISTS "order_orderNumber_key";
CREATE UNIQUE INDEX "order_organizationId_orderNumber_key" ON "order" ("organizationId", "orderNumber");

ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_sku_key";
DROP INDEX IF EXISTS "product_sku_key";
CREATE UNIQUE INDEX "product_organizationId_sku_key" ON "product" ("organizationId", "sku");

ALTER TABLE "discount" DROP CONSTRAINT IF EXISTS "discount_code_key";
DROP INDEX IF EXISTS "discount_code_key";
CREATE UNIQUE INDEX "discount_organizationId_code_key" ON "discount" ("organizationId", "code");

ALTER TABLE "customer" DROP CONSTRAINT IF EXISTS "customer_email_key";
DROP INDEX IF EXISTS "customer_email_key";
CREATE UNIQUE INDEX "customer_organizationId_email_key" ON "customer" ("organizationId", "email");

ALTER TABLE "bouncy_castles" DROP CONSTRAINT IF EXISTS "bouncy_castles_bouncerId_key";
DROP INDEX IF EXISTS "bouncy_castles_bouncerId_key";
CREATE UNIQUE INDEX "bouncy_castles_organizationId_bouncerId_key" ON "bouncy_castles" ("organizationId", "bouncerId");
