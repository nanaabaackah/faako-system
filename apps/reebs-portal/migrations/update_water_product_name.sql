-- Migration: Update Water Product Name from 12pk to 15pk
-- This script updates all existing water module records to reflect the corrected product name

-- Update waterRestock table
UPDATE "waterRestock"
SET "productKey" = 'gwater-15pk',
    "productName" = '15pk Gwater'
WHERE "productKey" = 'gwater-12pk'
   OR "productName" = '12pk Gwater';

-- Update waterSale table
UPDATE "waterSale"
SET "productKey" = 'gwater-15pk',
    "productName" = '15pk Gwater'
WHERE "productKey" = 'gwater-12pk'
   OR "productName" = '12pk Gwater';

-- Update waterAdjustment table
UPDATE "waterAdjustment"
SET "productKey" = 'gwater-15pk',
    "productName" = '15pk Gwater'
WHERE "productKey" = 'gwater-12pk'
   OR "productName" = '12pk Gwater';
