import { deriveWaterSettlement } from "../../../shared/waterSettlement.js";

export const loadWaterCollections = async (client, organizationId, productKey, customerId = null) => {
  const result = await client.query(
    `SELECT pr.id, pa.id AS "applicationId", w.id AS "saleId", w."productKey", w."customerId",
            w."customerName", pr.reference, pr."providerReference", pr.method, pr.provider,
            pa."amountCents", pr.currency, pr."paidAt", pr.status, pa.status AS "applicationStatus"
     FROM "paymentApplication" pa
     JOIN "paymentRecord" pr ON pr.id = pa."paymentId" AND pr."organizationId" = pa."organizationId"
     JOIN "waterSale" w ON w.id = pa."payableId" AND w."organizationId" = pa."organizationId"
     WHERE pa."organizationId" = $1 AND w."productKey" = $2 AND w."archivedAt" IS NULL
       AND pa."businessUnit" = 'WATER' AND pa."payableType" = 'WATER_ORDER'
       AND pr."businessUnit" = 'WATER' AND pr.status = 'PAID' AND pa.status = 'APPLIED'
       AND ($3::int IS NULL OR w."customerId" = $3)
     ORDER BY pr."paidAt" DESC, pr.id DESC`, [organizationId, productKey, customerId]
  );
  return result.rows;
};

export const projectWaterSales = (sales, collections) => {
  const applied = new Map();
  for (const collection of collections) {
    if (collection.status !== "PAID" || collection.applicationStatus !== "APPLIED") continue;
    const key = `${collection.productKey}:${collection.saleId}`;
    const total = applied.get(key) || { amountPaidCents: 0, applicationCount: 0 };
    total.amountPaidCents += Number(collection.amountCents);
    total.applicationCount += 1;
    applied.set(key, total);
  }
  return sales.map((sale) => ({ ...sale, ...deriveWaterSettlement(sale, applied.get(`${sale.productKey}:${sale.id}`)) }));
};
