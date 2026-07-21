CREATE TYPE "TrelloConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISABLED');
CREATE TYPE "TrelloSyncStatus" AS ENUM ('NOT_LINKED', 'SYNCED', 'ERROR');
CREATE TYPE "TrelloSyncSource" AS ENUM ('DEV_ERP', 'TRELLO');
CREATE TYPE "TrelloWebhookEventStatus" AS ENUM ('PROCESSED', 'IGNORED', 'ERROR');

ALTER TABLE "ProjectTask"
ADD COLUMN "trelloCardId" TEXT,
ADD COLUMN "trelloCardUrl" TEXT,
ADD COLUMN "trelloSyncStatus" "TrelloSyncStatus" NOT NULL DEFAULT 'NOT_LINKED',
ADD COLUMN "trelloLastSyncSource" "TrelloSyncSource",
ADD COLUMN "trelloLastSyncedAt" TIMESTAMP(3),
ADD COLUMN "trelloLastError" TEXT;

CREATE TABLE "TrelloConnection" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "apiTokenEncrypted" TEXT NOT NULL,
    "appSecretEncrypted" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "boardName" TEXT,
    "boardUrl" TEXT,
    "statusMappings" JSONB NOT NULL,
    "status" "TrelloConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "webhookId" TEXT,
    "webhookCallbackUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrelloConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrelloWebhookEvent" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "actionId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "cardId" TEXT,
    "clientIdentifier" TEXT,
    "status" "TrelloWebhookEventStatus" NOT NULL,
    "error" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrelloWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectTask_trelloCardId_key" ON "ProjectTask"("trelloCardId");
CREATE UNIQUE INDEX "TrelloConnection_organizationId_key" ON "TrelloConnection"("organizationId");
CREATE UNIQUE INDEX "TrelloConnection_webhookId_key" ON "TrelloConnection"("webhookId");
CREATE INDEX "TrelloConnection_status_idx" ON "TrelloConnection"("status");
CREATE UNIQUE INDEX "TrelloWebhookEvent_actionId_key" ON "TrelloWebhookEvent"("actionId");
CREATE INDEX "TrelloWebhookEvent_organizationId_createdAt_idx" ON "TrelloWebhookEvent"("organizationId", "createdAt");
CREATE INDEX "TrelloWebhookEvent_connectionId_createdAt_idx" ON "TrelloWebhookEvent"("connectionId", "createdAt");
CREATE INDEX "TrelloWebhookEvent_taskId_createdAt_idx" ON "TrelloWebhookEvent"("taskId", "createdAt");

ALTER TABLE "TrelloConnection" ADD CONSTRAINT "TrelloConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrelloWebhookEvent" ADD CONSTRAINT "TrelloWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrelloWebhookEvent" ADD CONSTRAINT "TrelloWebhookEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "TrelloConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrelloWebhookEvent" ADD CONSTRAINT "TrelloWebhookEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
