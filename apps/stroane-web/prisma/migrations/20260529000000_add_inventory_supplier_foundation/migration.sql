ALTER TABLE "CatalogueProduct"
  ADD COLUMN "availableQuantity" INTEGER,
  ADD COLUMN "reservedQuantity" INTEGER,
  ADD COLUMN "reorderThreshold" INTEGER;

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "email" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "location" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierContact" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "whatsapp" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SupplierContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogueProductSupplier" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "productSlug" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "supplierSku" TEXT,
  "supplierProductName" TEXT,
  "costPrice" DECIMAL(12, 2),
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "leadTimeDays" INTEGER,
  "minimumOrderQuantity" INTEGER,
  "isPreferred" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CatalogueProductSupplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "productSlug" TEXT NOT NULL,
  "variantId" TEXT,
  "sku" TEXT,
  "supplierId" TEXT,
  "quantityOnHand" INTEGER,
  "reservedQuantity" INTEGER,
  "availableQuantity" INTEGER,
  "reorderThreshold" INTEGER,
  "lowStockThreshold" INTEGER,
  "stockStatus" TEXT NOT NULL DEFAULT 'unavailable',
  "allowBackorder" BOOLEAN,
  "isPurchasable" BOOLEAN,
  "lastCountedAt" TIMESTAMP(3),
  "lastRestockedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "productSlug" TEXT NOT NULL,
  "variantId" TEXT,
  "supplierId" TEXT,
  "movementType" TEXT NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "quantityBefore" INTEGER,
  "quantityAfter" INTEGER,
  "reservedBefore" INTEGER,
  "reservedAfter" INTEGER,
  "reason" TEXT,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "supplierNote" TEXT,
  "purchaseNote" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAuditEntry" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "supplierId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "productSlug" TEXT,
  "variantId" TEXT,
  "beforeState" JSONB,
  "afterState" JSONB,
  "note" TEXT,
  "createdById" TEXT,
  "createdByName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Supplier_slug_key" ON "Supplier"("slug");
CREATE INDEX "Supplier_status_idx" ON "Supplier"("status");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

CREATE INDEX "SupplierContact_supplierId_idx" ON "SupplierContact"("supplierId");
CREATE INDEX "SupplierContact_email_idx" ON "SupplierContact"("email");

CREATE UNIQUE INDEX "CatalogueProductSupplier_productSlug_supplierId_key" ON "CatalogueProductSupplier"("productSlug", "supplierId");
CREATE INDEX "CatalogueProductSupplier_productId_idx" ON "CatalogueProductSupplier"("productId");
CREATE INDEX "CatalogueProductSupplier_productSlug_idx" ON "CatalogueProductSupplier"("productSlug");
CREATE INDEX "CatalogueProductSupplier_supplierId_idx" ON "CatalogueProductSupplier"("supplierId");

CREATE UNIQUE INDEX "InventoryItem_productSlug_variantId_key" ON "InventoryItem"("productSlug", "variantId");
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");
CREATE INDEX "InventoryItem_productSlug_idx" ON "InventoryItem"("productSlug");
CREATE INDEX "InventoryItem_variantId_idx" ON "InventoryItem"("variantId");
CREATE INDEX "InventoryItem_stockStatus_idx" ON "InventoryItem"("stockStatus");
CREATE INDEX "InventoryItem_supplierId_idx" ON "InventoryItem"("supplierId");

CREATE INDEX "InventoryMovement_inventoryItemId_idx" ON "InventoryMovement"("inventoryItemId");
CREATE INDEX "InventoryMovement_productSlug_idx" ON "InventoryMovement"("productSlug");
CREATE INDEX "InventoryMovement_variantId_idx" ON "InventoryMovement"("variantId");
CREATE INDEX "InventoryMovement_supplierId_idx" ON "InventoryMovement"("supplierId");
CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

CREATE INDEX "InventoryAuditEntry_inventoryItemId_idx" ON "InventoryAuditEntry"("inventoryItemId");
CREATE INDEX "InventoryAuditEntry_supplierId_idx" ON "InventoryAuditEntry"("supplierId");
CREATE INDEX "InventoryAuditEntry_productSlug_idx" ON "InventoryAuditEntry"("productSlug");
CREATE INDEX "InventoryAuditEntry_action_idx" ON "InventoryAuditEntry"("action");
CREATE INDEX "InventoryAuditEntry_createdAt_idx" ON "InventoryAuditEntry"("createdAt");

ALTER TABLE "SupplierContact"
  ADD CONSTRAINT "SupplierContact_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogueProductSupplier"
  ADD CONSTRAINT "CatalogueProductSupplier_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "CatalogueProduct"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CatalogueProductSupplier"
  ADD CONSTRAINT "CatalogueProductSupplier_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "CatalogueProduct"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryAuditEntry"
  ADD CONSTRAINT "InventoryAuditEntry_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryAuditEntry"
  ADD CONSTRAINT "InventoryAuditEntry_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
