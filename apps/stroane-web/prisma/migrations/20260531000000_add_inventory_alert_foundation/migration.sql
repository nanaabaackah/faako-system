ALTER TABLE "InventoryItem"
  ADD COLUMN "inventoryTrackingEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "InventoryAlert" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "alertType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT,
  "availableQuantity" INTEGER,
  "reservedQuantity" INTEGER,
  "reorderThreshold" INTEGER,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastNotificationAttemptAt" TIMESTAMP(3),
  "lastNotifiedAt" TIMESTAMP(3),
  "notificationCount" INTEGER NOT NULL DEFAULT 0,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAlertDispatch" (
  "id" TEXT NOT NULL,
  "alertId" TEXT,
  "batchKey" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "alertType" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "providerId" TEXT,
  "error" TEXT,
  "payloadSummary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryAlertDispatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryItem_inventoryTrackingEnabled_idx"
  ON "InventoryItem"("inventoryTrackingEnabled");

CREATE UNIQUE INDEX "InventoryAlert_inventoryItemId_alertType_key"
  ON "InventoryAlert"("inventoryItemId", "alertType");

CREATE INDEX "InventoryAlert_status_alertType_idx"
  ON "InventoryAlert"("status", "alertType");

CREATE INDEX "InventoryAlert_lastNotifiedAt_idx"
  ON "InventoryAlert"("lastNotifiedAt");

CREATE INDEX "InventoryAlertDispatch_alertId_idx"
  ON "InventoryAlertDispatch"("alertId");

CREATE INDEX "InventoryAlertDispatch_batchKey_idx"
  ON "InventoryAlertDispatch"("batchKey");

CREATE INDEX "InventoryAlertDispatch_channel_status_idx"
  ON "InventoryAlertDispatch"("channel", "status");

CREATE INDEX "InventoryAlertDispatch_createdAt_idx"
  ON "InventoryAlertDispatch"("createdAt");

ALTER TABLE "InventoryAlert"
  ADD CONSTRAINT "InventoryAlert_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryAlertDispatch"
  ADD CONSTRAINT "InventoryAlertDispatch_alertId_fkey"
  FOREIGN KEY ("alertId") REFERENCES "InventoryAlert"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
