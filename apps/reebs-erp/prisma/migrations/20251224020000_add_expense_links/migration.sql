-- AlterTable
ALTER TABLE "expense" ADD COLUMN "orderId" INTEGER;
ALTER TABLE "expense" ADD COLUMN "bookingId" INTEGER;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense" ADD CONSTRAINT "expense_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
