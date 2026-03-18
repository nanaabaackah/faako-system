/*
  Warnings:

  - Made the column `updatedAt` on table `booking` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isArchived` on table `product` required. This step will fail if there are existing NULL values in that column.
  - Made the column `isDeleted` on table `product` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "delivery" DROP CONSTRAINT "delivery_bookingId_fkey";

-- AlterTable
ALTER TABLE "booking" ALTER COLUMN "lastModifiedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "delivery" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "managerDevice" ALTER COLUMN "lastSeenAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "order" ALTER COLUMN "lastModifiedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "purchasePriceCad" INTEGER,
ALTER COLUMN "isArchived" SET NOT NULL,
ALTER COLUMN "archivedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "isDeleted" SET NOT NULL,
ALTER COLUMN "deletedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "lastUpdatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "stockMovement" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
