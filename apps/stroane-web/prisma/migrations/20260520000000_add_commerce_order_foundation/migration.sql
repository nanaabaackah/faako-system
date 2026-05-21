-- CreateEnum
CREATE TYPE "CommerceOrderStatus" AS ENUM ('PENDING', 'PAYMENT_PENDING', 'PAID', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CommerceOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "CommerceOrderStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "businessName" TEXT,
    "deliveryAddress" TEXT NOT NULL,
    "deliveryNotes" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paymentProvider" TEXT,
    "paymentReference" TEXT,
    "paymentStatus" TEXT,
    "source" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommerceOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommerceOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommerceOrder_orderNumber_key" ON "CommerceOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "CommerceOrder_status_createdAt_idx" ON "CommerceOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommerceOrder_customerEmail_idx" ON "CommerceOrder"("customerEmail");

-- CreateIndex
CREATE INDEX "CommerceOrder_paymentReference_idx" ON "CommerceOrder"("paymentReference");

-- CreateIndex
CREATE INDEX "CommerceOrderItem_orderId_idx" ON "CommerceOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "CommerceOrderItem_productSlug_idx" ON "CommerceOrderItem"("productSlug");

-- AddForeignKey
ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
