CREATE TABLE "CommerceReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "subtotal" DECIMAL(12, 2) NOT NULL,
    "total" DECIMAL(12, 2) NOT NULL,
    "paymentReference" TEXT,
    "paymentStatus" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "resendStatus" TEXT,
    "resendProviderId" TEXT,
    "resendError" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommerceReceipt_receiptNumber_key" ON "CommerceReceipt"("receiptNumber");
CREATE INDEX "CommerceReceipt_orderId_idx" ON "CommerceReceipt"("orderId");
CREATE INDEX "CommerceReceipt_customerEmail_idx" ON "CommerceReceipt"("customerEmail");
CREATE INDEX "CommerceReceipt_status_issuedAt_idx" ON "CommerceReceipt"("status", "issuedAt");
CREATE INDEX "CommerceReceipt_issuedAt_idx" ON "CommerceReceipt"("issuedAt");

ALTER TABLE "CommerceReceipt" ADD CONSTRAINT "CommerceReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
