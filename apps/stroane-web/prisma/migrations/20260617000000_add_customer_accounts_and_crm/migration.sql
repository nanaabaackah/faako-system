-- CreateEnum
CREATE TYPE "CustomerAccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED');

-- CreateTable
CREATE TABLE "CustomerAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "CustomerAccountStatus" NOT NULL DEFAULT 'INVITED',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "businessName" TEXT,
    "preferredContactMethod" TEXT,
    "defaultDeliveryAddress" TEXT,
    "deliveryNotes" TEXT,
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CommerceOrder" ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_email_key" ON "CustomerAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_inviteTokenHash_key" ON "CustomerAccount"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "CustomerAccount_status_createdAt_idx" ON "CustomerAccount"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerAccount_email_idx" ON "CustomerAccount"("email");

-- CreateIndex
CREATE INDEX "CustomerAccount_inviteExpiresAt_idx" ON "CustomerAccount"("inviteExpiresAt");

-- CreateIndex
CREATE INDEX "CommerceOrder_customerId_idx" ON "CommerceOrder"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerAccount" ADD CONSTRAINT "CustomerAccount_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "SiteUser"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "CustomerAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
