import { deriveWaterSettlement } from "../../../shared/waterSettlement.js";
import { loadWaterCustomerCredit } from "./customerCredit.js";

export const loadWaterCustomerDetail = async (client, organizationId, customerId) => {
  const salesResult = await client.query(`SELECT w.id, w."productName", w.quantity,
    w."saleChannel", w."paymentMethod", w."paymentStatus", w."unitPrice", w."totalAmount", w.date,
    COALESCE(p."amountPaidCents", 0) AS "amountPaidCents", COALESCE(p."applicationCount", 0) AS "applicationCount"
    FROM "waterSale" w
    LEFT JOIN LATERAL (
      SELECT SUM(pa."amountCents") FILTER (WHERE pa.status = 'APPLIED' AND pr.status = 'PAID') AS "amountPaidCents",
        COUNT(*) AS "applicationCount"
      FROM "paymentApplication" pa JOIN "paymentRecord" pr
        ON pr.id = pa."paymentId" AND pr."organizationId" = pa."organizationId"
      WHERE pa."organizationId" = w."organizationId" AND pa."payableId" = w.id
        AND pa."businessUnit" = 'WATER' AND pa."payableType" = 'WATER_ORDER'
        AND pr."businessUnit" = 'WATER' AND pa.currency = 'GHS' AND pr.currency = 'GHS'
    ) p ON TRUE
    WHERE w."customerId" = $1 AND w."organizationId" = $2 AND w."archivedAt" IS NULL
    ORDER BY w.date DESC, w.id DESC`, [customerId, organizationId]);
  const sales = salesResult.rows.map((row) => ({ ...row, ...deriveWaterSettlement(row, row) }));
  const waterTotals = sales.reduce((totals, sale) => ({
    sales: totals.sales + 1, revenue: totals.revenue + Number(sale.totalAmount),
    quantity: totals.quantity + Number(sale.quantity),
    outstandingCents: totals.outstandingCents + sale.balanceDueCents,
    legacyPaidCents: totals.legacyPaidCents + sale.legacyPaidCents,
  }), { sales: 0, revenue: 0, quantity: 0, outstandingCents: 0, legacyPaidCents: 0 });
  const credit = await loadWaterCustomerCredit(client, organizationId, customerId);
  return { scope: "water", waterSales: sales.slice(0, 10), waterTotals,
    waterCredit: { availableCents: credit.availableCents }, historyLimits: { waterSales: 10 } };
};
