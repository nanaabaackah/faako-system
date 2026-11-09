-- Distinguish system-derived invoice payment projections from manual accounting entries.
-- Existing records remain unchanged; no backfill is attempted without reconciliation.
ALTER TYPE "AccountingSource" ADD VALUE IF NOT EXISTS 'INVOICE_PAYMENT';
