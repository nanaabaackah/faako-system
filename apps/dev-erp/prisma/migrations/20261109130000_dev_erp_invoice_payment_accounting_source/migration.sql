-- Identify system-derived invoice payment accounting projections independently of manual entries.
ALTER TYPE "AccountingSource" ADD VALUE IF NOT EXISTS 'INVOICE_PAYMENT';
