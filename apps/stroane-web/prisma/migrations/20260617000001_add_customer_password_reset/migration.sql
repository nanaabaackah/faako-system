-- AlterTable
ALTER TABLE "CustomerAccount"
ADD COLUMN "passwordResetTokenHash" TEXT,
ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAccount_passwordResetTokenHash_key"
ON "CustomerAccount"("passwordResetTokenHash");

-- CreateIndex
CREATE INDEX "CustomerAccount_passwordResetExpiresAt_idx"
ON "CustomerAccount"("passwordResetExpiresAt");
