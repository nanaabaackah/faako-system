-- AlterTable
ALTER TABLE "bouncy_castles" ADD COLUMN "productId" INTEGER;
ALTER TABLE "indoor_games" ADD COLUMN "productId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "bouncy_castles_productId_key" ON "bouncy_castles"("productId");
CREATE UNIQUE INDEX "indoor_games_productId_key" ON "indoor_games"("productId");

-- AddForeignKey
ALTER TABLE "bouncy_castles" ADD CONSTRAINT "bouncy_castles_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "indoor_games" ADD CONSTRAINT "indoor_games_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
