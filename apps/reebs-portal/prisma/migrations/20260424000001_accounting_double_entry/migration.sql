-- ============================================================
-- REEBS Accounting — Double-Entry Engine Migration
-- ============================================================

-- SystemConfig: key-value store for GRA compliance fields
CREATE TABLE IF NOT EXISTS "systemConfig" (
    "id"             SERIAL       NOT NULL,
    "organizationId" INTEGER      NOT NULL DEFAULT 1,
    "key"            TEXT         NOT NULL,
    "value"          TEXT         NOT NULL,
    "description"    TEXT,
    "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "systemConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "systemConfig_org_key_uk"  ON "systemConfig" ("organizationId", "key");
CREATE        INDEX IF NOT EXISTS "systemConfig_org_idx"     ON "systemConfig" ("organizationId");

-- ChartOfAccount
CREATE TABLE IF NOT EXISTS "chartOfAccount" (
    "id"              SERIAL      NOT NULL,
    "organizationId"  INTEGER     NOT NULL DEFAULT 1,
    "accountCode"     TEXT        NOT NULL,
    "accountName"     TEXT        NOT NULL,
    "accountType"     TEXT        NOT NULL, -- ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
    "normalBalance"   TEXT        NOT NULL, -- DEBIT | CREDIT
    "parentAccountId" INTEGER,
    "isSystemAccount" BOOLEAN     NOT NULL DEFAULT FALSE,
    "isActive"        BOOLEAN     NOT NULL DEFAULT TRUE,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "chartOfAccount_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "chartOfAccount_parent_fkey"   FOREIGN KEY ("parentAccountId")
        REFERENCES "chartOfAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "chartOfAccount_org_code_uk"  ON "chartOfAccount" ("organizationId", "accountCode");
CREATE        INDEX IF NOT EXISTS "chartOfAccount_type_idx"     ON "chartOfAccount" ("organizationId", "accountType", "isActive");

-- Prevent deletion of system accounts
CREATE OR REPLACE FUNCTION prevent_system_account_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."isSystemAccount" THEN
        RAISE EXCEPTION 'System account % (%) cannot be deleted.', OLD."accountCode", OLD."accountName";
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_system_account_delete ON "chartOfAccount";
CREATE TRIGGER trg_prevent_system_account_delete
    BEFORE DELETE ON "chartOfAccount"
    FOR EACH ROW EXECUTE FUNCTION prevent_system_account_delete();

-- TaxRate
CREATE TABLE IF NOT EXISTS "taxRate" (
    "id"             SERIAL      NOT NULL,
    "organizationId" INTEGER     NOT NULL DEFAULT 1,
    "taxType"        TEXT        NOT NULL,
    "label"          TEXT        NOT NULL,
    "rateInBps"      INTEGER     NOT NULL, -- basis points: 1500 = 15.00%
    "effectiveFrom"  TIMESTAMPTZ NOT NULL,
    "effectiveTo"    TIMESTAMPTZ,
    "isActive"       BOOLEAN     NOT NULL DEFAULT TRUE,
    "accountId"      INTEGER,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "taxRate_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "taxRate_account_fkey" FOREIGN KEY ("accountId")
        REFERENCES "chartOfAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "taxRate_type_idx" ON "taxRate" ("organizationId", "taxType", "isActive");

-- HistoricalImportBatch
CREATE TABLE IF NOT EXISTS "historicalImportBatch" (
    "id"              SERIAL      NOT NULL,
    "organizationId"  INTEGER     NOT NULL DEFAULT 1,
    "batchName"       TEXT        NOT NULL,
    "periodStart"     TIMESTAMPTZ NOT NULL,
    "periodEnd"       TIMESTAMPTZ NOT NULL,
    "source"          TEXT        NOT NULL,
    "isPosted"        BOOLEAN     NOT NULL DEFAULT FALSE,
    "postedAt"        TIMESTAMPTZ,
    "postedByUserId"  INTEGER,
    "notes"           TEXT,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "historicalImportBatch_pkey"    PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "historicalImportBatch_org_name_uk"  ON "historicalImportBatch" ("organizationId", "batchName");
CREATE        INDEX IF NOT EXISTS "historicalImportBatch_period_idx"   ON "historicalImportBatch" ("organizationId", "periodStart");

-- JournalEntry
CREATE TABLE IF NOT EXISTS "journalEntry" (
    "id"              SERIAL      NOT NULL,
    "organizationId"  INTEGER     NOT NULL DEFAULT 1,
    "date"            TIMESTAMPTZ NOT NULL,
    "reference"       TEXT        NOT NULL,
    "description"     TEXT,
    "createdByUserId" INTEGER,
    "isPosted"        BOOLEAN     NOT NULL DEFAULT FALSE,
    "postedAt"        TIMESTAMPTZ,
    "postedByUserId"  INTEGER,
    "isReversed"      BOOLEAN     NOT NULL DEFAULT FALSE,
    "reversalOfId"    INTEGER,
    "importBatchId"   INTEGER,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "journalEntry_pkey"          PRIMARY KEY ("id"),
    CONSTRAINT "journalEntry_reversal_fkey" FOREIGN KEY ("reversalOfId")
        REFERENCES "journalEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "journalEntry_batch_fkey"    FOREIGN KEY ("importBatchId")
        REFERENCES "historicalImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "journalEntry_org_ref_uk"  ON "journalEntry" ("organizationId", "reference");
CREATE        INDEX IF NOT EXISTS "journalEntry_date_idx"    ON "journalEntry" ("organizationId", "date");
CREATE        INDEX IF NOT EXISTS "journalEntry_batch_idx"   ON "journalEntry" ("importBatchId");

-- JournalLine
CREATE TABLE IF NOT EXISTS "journalLine" (
    "id"             SERIAL  NOT NULL,
    "journalEntryId" INTEGER NOT NULL,
    "accountId"      INTEGER NOT NULL,
    "debit"          INTEGER NOT NULL DEFAULT 0, -- pesewas
    "credit"         INTEGER NOT NULL DEFAULT 0, -- pesewas
    "description"    TEXT,
    CONSTRAINT "journalLine_pkey"    PRIMARY KEY ("id"),
    CONSTRAINT "journalLine_entry_fkey"   FOREIGN KEY ("journalEntryId")
        REFERENCES "journalEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "journalLine_account_fkey" FOREIGN KEY ("accountId")
        REFERENCES "chartOfAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "journalLine_debit_non_neg"  CHECK ("debit"  >= 0),
    CONSTRAINT "journalLine_credit_non_neg" CHECK ("credit" >= 0),
    CONSTRAINT "journalLine_not_both_zero"  CHECK ("debit" > 0 OR "credit" > 0)
);
CREATE INDEX IF NOT EXISTS "journalLine_entry_idx"   ON "journalLine" ("journalEntryId");
CREATE INDEX IF NOT EXISTS "journalLine_account_idx" ON "journalLine" ("accountId");

-- Prevent modification of lines belonging to a posted journal
CREATE OR REPLACE FUNCTION prevent_posted_journal_line_change()
RETURNS TRIGGER AS $$
DECLARE
    posted BOOLEAN;
BEGIN
    SELECT "isPosted" INTO posted
    FROM "journalEntry"
    WHERE id = COALESCE(OLD."journalEntryId", NEW."journalEntryId");

    IF posted THEN
        RAISE EXCEPTION 'Journal entry % is posted and cannot be modified. Use a reversal.', COALESCE(OLD."journalEntryId", NEW."journalEntryId");
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posted_line_insert ON "journalLine";
CREATE TRIGGER trg_posted_line_insert
    BEFORE INSERT ON "journalLine"
    FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_line_change();

DROP TRIGGER IF EXISTS trg_posted_line_update ON "journalLine";
CREATE TRIGGER trg_posted_line_update
    BEFORE UPDATE ON "journalLine"
    FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_line_change();

DROP TRIGGER IF EXISTS trg_posted_line_delete ON "journalLine";
CREATE TRIGGER trg_posted_line_delete
    BEFORE DELETE ON "journalLine"
    FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_line_change();

-- Prevent un-posting or direct edit of a posted journal header
CREATE OR REPLACE FUNCTION prevent_posted_journal_header_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."isPosted" = TRUE AND NEW."isPosted" = FALSE THEN
        RAISE EXCEPTION 'Cannot un-post journal entry %. Post is permanent; use a reversal.', OLD.id;
    END IF;
    IF OLD."isPosted" = TRUE AND (
        NEW."date"        IS DISTINCT FROM OLD."date"        OR
        NEW."reference"   IS DISTINCT FROM OLD."reference"   OR
        NEW."description" IS DISTINCT FROM OLD."description"
    ) THEN
        RAISE EXCEPTION 'Posted journal entry % is immutable. Use a reversal.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_posted_header_update ON "journalEntry";
CREATE TRIGGER trg_posted_header_update
    BEFORE UPDATE ON "journalEntry"
    FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_header_change();

-- OpeningBalance
CREATE TABLE IF NOT EXISTS "openingBalance" (
    "id"              SERIAL      NOT NULL,
    "organizationId"  INTEGER     NOT NULL DEFAULT 1,
    "accountId"       INTEGER     NOT NULL,
    "amount"          INTEGER     NOT NULL, -- pesewas; positive = normal balance side
    "balanceDate"     TIMESTAMPTZ NOT NULL,
    "notes"           TEXT,
    "importBatchId"   INTEGER,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "openingBalance_pkey"        PRIMARY KEY ("id"),
    CONSTRAINT "openingBalance_account_fkey" FOREIGN KEY ("accountId")
        REFERENCES "chartOfAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "openingBalance_batch_fkey"   FOREIGN KEY ("importBatchId")
        REFERENCES "historicalImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "openingBalance_org_acct_date_uk" ON "openingBalance" ("organizationId", "accountId", "balanceDate");
CREATE        INDEX IF NOT EXISTS "openingBalance_date_idx"          ON "openingBalance" ("organizationId", "balanceDate");
