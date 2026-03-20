-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "stockMovement" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockMovement" ADD CONSTRAINT "stockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
