-- CreateTable
CREATE TABLE IF NOT EXISTS "deferredRevenue" (
    "id"                 SERIAL          NOT NULL,
    "bookingId"          INTEGER         NOT NULL,
    "totalAmount"        INTEGER         NOT NULL,
    "recognisedAmount"   INTEGER         NOT NULL DEFAULT 0,
    "unrecognisedAmount" INTEGER         NOT NULL,
    "startDate"          TIMESTAMP(3)    NOT NULL,
    "endDate"            TIMESTAMP(3)    NOT NULL,
    "createdAt"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "deferredRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "revenueRecognitionLine" (
    "id"                TEXT            NOT NULL,
    "deferredRevenueId" INTEGER         NOT NULL,
    "periodDate"        TIMESTAMP(3)    NOT NULL,
    "amountToRecognise" INTEGER         NOT NULL,
    "isRecognised"      BOOLEAN         NOT NULL DEFAULT false,
    "recognisedAt"      TIMESTAMP(3),
    "journalEntryId"    TEXT,

    CONSTRAINT "revenueRecognitionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "deferredRevenue_bookingId_key"  ON "deferredRevenue" ("bookingId");
CREATE INDEX  IF NOT EXISTS "deferredRevenue_bookingId_idx"        ON "deferredRevenue" ("bookingId");
CREATE INDEX  IF NOT EXISTS "revenueRecognitionLine_deferredRevId"  ON "revenueRecognitionLine" ("deferredRevenueId");
CREATE INDEX  IF NOT EXISTS "revenueRecognitionLine_period_idx"     ON "revenueRecognitionLine" ("periodDate", "isRecognised");

-- AddForeignKey
ALTER TABLE "deferredRevenue"
    ADD CONSTRAINT "deferredRevenue_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "booking" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenueRecognitionLine"
    ADD CONSTRAINT "revenueRecognitionLine_deferredRevenueId_fkey"
    FOREIGN KEY ("deferredRevenueId") REFERENCES "deferredRevenue" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
