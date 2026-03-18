/*
  Warnings:

  - You are about to drop the column `totalCents` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `lineTotalCents` on the `orderItem` table. All the data in the column will be lost.
  - You are about to drop the column `unitPriceCents` on the `orderItem` table. All the data in the column will be lost.
  - You are about to drop the column `priceCents` on the `product` table. All the data in the column will be lost.
  - Added the required column `total_amount` to the `order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_amount` to the `orderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unit_price` to the `orderItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "order" DROP COLUMN "totalCents",
ADD COLUMN     "total_amount" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "orderItem" DROP COLUMN "lineTotalCents",
DROP COLUMN "unitPriceCents",
ADD COLUMN     "total_amount" INTEGER NOT NULL,
ADD COLUMN     "unit_price" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "product" DROP COLUMN "priceCents",
ADD COLUMN     "price" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "stockMovement" ADD COLUMN     "reference" TEXT;
