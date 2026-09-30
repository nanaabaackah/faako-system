export const lockInventoryProduct = async (client, organizationId, productId) => {
  const result = await client.query(
    `SELECT
       p.id,
       p.name,
       p.stock,
       p.price,
       p."itemType",
       p."sourceCategoryCode",
       p."isActive",
       p."isArchived",
       p."isDeleted",
       EXISTS (
         SELECT 1
         FROM "waterProductConfig" water_scope
         WHERE water_scope."organizationId" = p."organizationId"
           AND water_scope."inventoryProductId" = p.id
           AND water_scope."isActive" = TRUE
       ) AS "isWaterProduct"
     FROM "product" p
     WHERE p.id = $1
       AND p."organizationId" = $2
     FOR UPDATE`,
    [productId, organizationId]
  );
  return result.rows[0] || null;
};

export const lockInventoryVariant = async (client, organizationId, productId, variantId) => {
  const result = await client.query(
    `SELECT id, "inventoryItemId", "stockQty", "reservedQty", status
     FROM "inventoryVariant"
     WHERE id = $1
       AND "inventoryItemId" = $2
       AND "organizationId" = $3
     FOR UPDATE`,
    [variantId, productId, organizationId]
  );
  return result.rows[0] || null;
};

export const findMovementByIdempotencyKey = async (client, organizationId, idempotencyKey) => {
  if (!idempotencyKey) return null;
  const result = await client.query(
    `SELECT id, "productId", "variantId", "resultingStock", "idempotencyKey"
     FROM "stockMovement"
     WHERE "organizationId" = $1
       AND "idempotencyKey" = $2
     LIMIT 1`,
    [organizationId, idempotencyKey]
  );
  return result.rows[0] || null;
};

export const getPeakRentalReservation = async (client, organizationId, productId) => {
  const result = await client.query(
    `SELECT COALESCE(MAX(daily_quantity), 0)::int AS "peakReserved"
     FROM (
       SELECT reservation_date, SUM(bi.quantity)::int AS daily_quantity
       FROM "bookingItem" bi
       JOIN "booking" b
         ON b.id = bi."bookingId"
        AND b."organizationId" = bi."organizationId"
       CROSS JOIN LATERAL generate_series(
         b."eventDate"::date,
         b."eventEndDate"::date,
         INTERVAL '1 day'
       ) AS reservation_days(reservation_date)
       WHERE bi."organizationId" = $1
         AND bi."productId" = $2
         AND bi."variantId" IS NULL
         AND LOWER(COALESCE(b.status, '')) IN ('pending', 'confirmed')
       GROUP BY reservation_date
     ) reservations`,
    [organizationId, productId]
  );
  return Number(result.rows[0]?.peakReserved || 0);
};

export const applyProductStockDelta = async (
  client,
  { organizationId, productId, delta, actorUserId }
) => {
  const result = await client.query(
    `UPDATE "product"
     SET stock = COALESCE(stock, 0) + $1,
         "stockValue" = (COALESCE(stock, 0) + $1) * COALESCE(price, 0),
         "lastUpdatedByUserId" = COALESCE($3, "lastUpdatedByUserId"),
         "lastUpdatedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE id = $2
       AND "organizationId" = $4
       AND ($1 >= 0 OR COALESCE(stock, 0) >= ABS($1))
     RETURNING id, stock AS "resultingStock", "lastUpdatedAt", "lastUpdatedByUserId"`,
    [delta, productId, actorUserId || null, organizationId]
  );
  return result.rows[0] || null;
};

export const applyVariantStockDelta = async (
  client,
  { organizationId, productId, variantId, delta, actorUserId }
) => {
  const result = await client.query(
    `UPDATE "inventoryVariant"
     SET "stockQty" = "stockQty" + $1,
         "updatedAt" = NOW()
     WHERE id = $2
       AND "inventoryItemId" = $3
       AND "organizationId" = $4
       AND ($1 >= 0 OR GREATEST("stockQty" - "reservedQty", 0) >= ABS($1))
     RETURNING id, "stockQty" AS "resultingStock", "reservedQty",
       GREATEST("stockQty" - "reservedQty", 0) AS "availableQty"`,
    [delta, variantId, productId, organizationId]
  );
  if (result.rowCount === 0) return null;

  await client.query(
    `UPDATE "product" p
     SET stock = COALESCE((
           SELECT SUM(v."stockQty")::int
           FROM "inventoryVariant" v
           WHERE v."organizationId" = p."organizationId"
             AND v."inventoryItemId" = p.id
             AND LOWER(COALESCE(v.status, 'active')) <> 'inactive'
         ), 0),
         "stockValue" = COALESCE((
           SELECT SUM(v."stockQty")::int
           FROM "inventoryVariant" v
           WHERE v."organizationId" = p."organizationId"
             AND v."inventoryItemId" = p.id
             AND LOWER(COALESCE(v.status, 'active')) <> 'inactive'
         ), 0) * COALESCE(p.price, 0),
         "lastUpdatedByUserId" = COALESCE($2, p."lastUpdatedByUserId"),
         "lastUpdatedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE p.id = $1
       AND p."organizationId" = $3`,
    [productId, actorUserId || null, organizationId]
  );

  return result.rows[0];
};

export const insertInventoryMovement = async (
  client,
  {
    organizationId,
    adjustment,
    previousStock,
    resultingStock,
    actor,
    sourceType = adjustment.reasonCode || "MANUAL_ADJUSTMENT",
    sourceId = null,
  }
) => {
  const result = await client.query(
    `INSERT INTO "stockMovement" (
       "organizationId", "productId", "variantId", type, quantity,
       notes, reference, "soldMonth", date,
       "performedByUserId", "performedByName", "performedByEmail",
       "idempotencyKey", "sourceType", "sourceId", "previousStock", "resultingStock", "createdAt"
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10,$11,$12,$13,$14,$15,$16,NOW())
     RETURNING id`,
    [
      organizationId,
      adjustment.productId,
      adjustment.variantId,
      adjustment.type,
      adjustment.quantity,
      adjustment.notes,
      adjustment.reference,
      adjustment.soldMonth,
      actor.userId || null,
      actor.userName || "Internal user",
      actor.userEmail || null,
      adjustment.idempotencyKey,
      sourceType,
      sourceId,
      previousStock,
      resultingStock,
    ]
  );
  return Number(result.rows[0]?.id || 0) || null;
};
