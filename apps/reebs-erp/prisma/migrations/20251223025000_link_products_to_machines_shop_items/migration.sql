-- AlterTable
ALTER TABLE "machines" ADD COLUMN "productId" INTEGER;
ALTER TABLE "shop_items" ADD COLUMN "productId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "machines_productId_key" ON "machines"("productId");
CREATE UNIQUE INDEX "shop_items_productId_key" ON "shop_items"("productId");

-- AddForeignKey
ALTER TABLE "machines" ADD CONSTRAINT "machines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
