-- CreateTable
CREATE TABLE "bouncy_castles" (
    "id" SERIAL NOT NULL,
    "bouncerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "footprint" TEXT,
    "height" TEXT,
    "capacity" TEXT,
    "recommendedAge" TEXT,
    "priceRange" TEXT,
    "bestFor" TEXT,
    "features" TEXT,
    "image" TEXT,
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bouncy_castles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indoor_games" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER,
    "price" INTEGER,
    "rate" TEXT,
    "availability" TEXT,
    "category" TEXT,
    "image" TEXT,
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indoor_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machines" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER,
    "price" INTEGER,
    "rate" TEXT,
    "availability" TEXT,
    "category" TEXT,
    "image" TEXT,
    "page" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "ageRange" TEXT,
    "category" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bouncy_castles_bouncerId_key" ON "bouncy_castles"("bouncerId");
