-- Keep the existing physical tables for compatibility with deployed raw SQL,
-- but document the new user-facing language and expose read aliases.
COMMENT ON TABLE "sourceCategory" IS 'User-facing inventory Products. Physical name retained for compatibility.';
COMMENT ON TABLE "specificCategory" IS 'User-facing inventory Categories linked to inventory Products. Physical name retained for compatibility.';
COMMENT ON COLUMN "product"."sourceCategoryId" IS 'User-facing inventory Product id.';
COMMENT ON COLUMN "product"."sourceCategoryCode" IS 'User-facing inventory Product code.';
COMMENT ON COLUMN "product"."specificCategory" IS 'User-facing inventory Category name.';
COMMENT ON COLUMN "specificCategory"."sourceCategoryId" IS 'User-facing inventory Product id.';
COMMENT ON COLUMN "specificCategory"."sourceCategoryCode" IS 'User-facing inventory Product code.';

CREATE OR REPLACE VIEW "inventoryProduct" AS
SELECT
  id,
  "organizationId",
  name,
  slug,
  "isActive",
  "createdAt",
  "updatedAt"
FROM "sourceCategory";

COMMENT ON VIEW "inventoryProduct" IS 'Read alias for user-facing inventory Products backed by sourceCategory.';

CREATE OR REPLACE VIEW "inventoryCategory" AS
SELECT
  id,
  "organizationId",
  "sourceCategoryId" AS "productId",
  "sourceCategoryCode" AS "productCode",
  name,
  slug,
  "isActive",
  "createdAt",
  "updatedAt"
FROM "specificCategory";

COMMENT ON VIEW "inventoryCategory" IS 'Read alias for user-facing inventory Categories backed by specificCategory.';
