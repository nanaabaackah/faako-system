-- DropForeignKey
ALTER TABLE "maintenanceLog" DROP CONSTRAINT "maintenanceLog_productId_fkey";

-- DropIndex
DROP INDEX "maintenanceLog_productId_idx";

-- DropIndex
DROP INDEX "product_vendorId_idx";

-- AlterTable
ALTER TABLE "maintenanceLog" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "attendantsNeeded" INTEGER;

-- AlterTable
ALTER TABLE "vendor" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "maintenanceLog" ADD CONSTRAINT "maintenanceLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
