import { getWaterCollectedCents, getWaterBalanceDueCents } from "@faako/water-domain";

// Read only. The shared payment ledger owns provider collections; never copy
// them into Core orders or create payments while rendering the Water dashboard.
export const loadWaterCollections = async (client, organizationId, productKey) => {
  const result = await client.query(
    `SELECT a."payableId" AS "saleId", COUNT(*)::int AS "applicationCount",
            COALESCE(SUM(a."amountCents") FILTER (WHERE a.status = 'APPLIED'), 0)::bigint AS "amountPaidCents"
     FROM "paymentApplication" a
     JOIN "paymentRecord" p ON p.id = a."paymentId" AND p."organizationId" = a."organizationId"
     JOIN "waterSale" w ON w.id = a."payableId" AND w."organizationId" = a."organizationId"
     WHERE a."organizationId" = $1 AND w."productKey" = $2 AND w."archivedAt" IS NULL
       AND a."payableType" = 'WATER_ORDER' AND a."businessUnit" = 'WATER'
       AND p."businessUnit" = 'WATER' AND p.status = 'PAID'
       AND a.currency = 'GHS' AND p.currency = 'GHS'
     GROUP BY a."payableId"`,
    [organizationId, productKey]
  );
  return result.rows || [];
};

export const projectWaterSales = (sales, collections = []) => {
  const bySale = new Map(collections.map((row) => [Number(row.saleId), row]));
  return sales.map((sale) => {
    const collection = bySale.get(Number(sale.id));
    const amountPaidCents = getWaterCollectedCents(collection ? { ...sale, amountPaidCents: collection.amountPaidCents } : sale);
    const balanceDueCents = getWaterBalanceDueCents({ ...sale, amountPaidCents });
    return {
      ...sale,
      amountPaidCents,
      balanceDueCents,
      collectionSource: collection ? "payment-applications" : "legacy-sale-status",
      // An applied ledger amount takes precedence over a stale paid flag. Keep
      // legacy records exactly as recorded when there is no collection ledger.
      ...(collection ? { paymentStatus: balanceDueCents === 0 ? "paid" : amountPaidCents > 0 ? "pending" : "unpaid" } : {}),
    };
  });
};
