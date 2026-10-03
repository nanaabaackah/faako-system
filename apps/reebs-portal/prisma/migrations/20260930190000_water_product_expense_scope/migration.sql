-- Preserve the existing single-product ledger; new sachet expenses are separate.
-- No stock, sale, cost or expense amount is changed, and no rows are deleted.
ALTER TABLE "waterExpense"
  ADD COLUMN IF NOT EXISTS "productKey" TEXT NOT NULL DEFAULT 'gwater-15pk';
