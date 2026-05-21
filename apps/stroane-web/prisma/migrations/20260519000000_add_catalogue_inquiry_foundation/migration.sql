-- CreateEnum
CREATE TYPE "CatalogueInquiryStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'RESPONDED', 'ARCHIVED', 'SPAM');

-- CreateTable
CREATE TABLE "CatalogueCategory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogueCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categorySlug" TEXT,
    "subcategory" TEXT,
    "brand" TEXT,
    "sku" TEXT,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "price" DECIMAL(12,2),
    "priceLabel" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "unit" TEXT,
    "image" TEXT,
    "images" JSONB,
    "tag" TEXT,
    "stockStatus" TEXT NOT NULL DEFAULT 'quote_required',
    "availability" TEXT,
    "quoteOnly" BOOLEAN NOT NULL DEFAULT true,
    "features" JSONB,
    "specifications" JSONB,
    "tags" JSONB,
    "useCases" JSONB,
    "inquiryCta" TEXT,
    "sourceRefs" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogueProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueInquiry" (
    "id" TEXT NOT NULL,
    "status" "CatalogueInquiryStatus" NOT NULL DEFAULT 'RECEIVED',
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "businessName" TEXT,
    "message" TEXT NOT NULL,
    "productSlug" TEXT,
    "productName" TEXT,
    "source" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogueInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfileContent" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfileContent_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueCategory_slug_key" ON "CatalogueCategory"("slug");

-- CreateIndex
CREATE INDEX "CatalogueCategory_isActive_sortOrder_idx" ON "CatalogueCategory"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueProduct_slug_key" ON "CatalogueProduct"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueProduct_sku_key" ON "CatalogueProduct"("sku");

-- CreateIndex
CREATE INDEX "CatalogueProduct_categorySlug_idx" ON "CatalogueProduct"("categorySlug");

-- CreateIndex
CREATE INDEX "CatalogueProduct_isPublished_updatedAt_idx" ON "CatalogueProduct"("isPublished", "updatedAt");

-- CreateIndex
CREATE INDEX "CatalogueProduct_name_idx" ON "CatalogueProduct"("name");

-- CreateIndex
CREATE INDEX "CatalogueInquiry_status_createdAt_idx" ON "CatalogueInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogueInquiry_productSlug_idx" ON "CatalogueInquiry"("productSlug");

-- CreateIndex
CREATE INDEX "CatalogueInquiry_email_idx" ON "CatalogueInquiry"("email");

-- CreateIndex
CREATE INDEX "BusinessProfileContent_isPublic_idx" ON "BusinessProfileContent"("isPublic");

-- AddForeignKey
ALTER TABLE "CatalogueProduct" ADD CONSTRAINT "CatalogueProduct_categorySlug_fkey"
    FOREIGN KEY ("categorySlug") REFERENCES "CatalogueCategory"("slug")
    ON DELETE SET NULL ON UPDATE CASCADE;
