-- AlterTable
ALTER TABLE "vendor" ADD COLUMN     "suppliedItems" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "userSession" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "userId" INTEGER NOT NULL,
    "sessionTokenId" TEXT NOT NULL,
    "remember" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "userSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountingManualSales" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "year" INTEGER NOT NULL,
    "monthlySales" JSONB NOT NULL,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accountingManualSales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accountingConfig" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "balanceInputs" JSONB,
    "taxInputs" JSONB,
    "ghanaTaxConfig" JSONB,
    "createdByUserId" INTEGER,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accountingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waterRestock" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "productKey" TEXT NOT NULL DEFAULT 'gwater-12pk',
    "productName" TEXT NOT NULL DEFAULT '12pk Gwater',
    "quantity" INTEGER NOT NULL,
    "unitCost" INTEGER NOT NULL DEFAULT 2200,
    "vendorId" INTEGER,
    "vendorName" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waterRestock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waterSale" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "productKey" TEXT NOT NULL DEFAULT 'gwater-12pk',
    "productName" TEXT NOT NULL DEFAULT '12pk Gwater',
    "quantity" INTEGER NOT NULL,
    "saleChannel" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "paymentReference" TEXT,
    "providerReference" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'none',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "customerId" INTEGER,
    "customerName" TEXT,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waterSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waterExpense" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waterExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waterAdjustment" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL DEFAULT 1,
    "productKey" TEXT NOT NULL DEFAULT 'gwater-12pk',
    "productName" TEXT NOT NULL DEFAULT '12pk Gwater',
    "quantityDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waterAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "userSession_sessionTokenId_key" ON "userSession"("sessionTokenId");

-- CreateIndex
CREATE INDEX "userSession_userId_organizationId_idx" ON "userSession"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "userSession_organizationId_expiresAt_revokedAt_idx" ON "userSession"("organizationId", "expiresAt", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "accountingManualSales_organizationId_year_key" ON "accountingManualSales"("organizationId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "accountingConfig_organizationId_key" ON "accountingConfig"("organizationId");

-- AddForeignKey
ALTER TABLE "userSession" ADD CONSTRAINT "userSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userSession" ADD CONSTRAINT "userSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountingManualSales" ADD CONSTRAINT "accountingManualSales_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accountingConfig" ADD CONSTRAINT "accountingConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterRestock" ADD CONSTRAINT "waterRestock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterSale" ADD CONSTRAINT "waterSale_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterSale" ADD CONSTRAINT "waterSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterExpense" ADD CONSTRAINT "waterExpense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waterAdjustment" ADD CONSTRAINT "waterAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "product_barcode_org_unique" RENAME TO "product_organizationId_barcode_key";
