-- AlterTable
ALTER TABLE "CommerceOrder"
ADD COLUMN "paymentMetadata" JSONB,
ADD COLUMN "paymentInitializedAt" TIMESTAMP(3),
ADD COLUMN "paymentVerifiedAt" TIMESTAMP(3),
ADD COLUMN "paymentFailedAt" TIMESTAMP(3);
