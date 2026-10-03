// Cash receipts, not earned revenue or invoice totals. One row per payment,
// irrespective of the number of applications; legacy mirrors are excluded.
export const fetchCoreCollectionSummary = async ({ client, organizationId, window, coreOrderFilter }) => {
  const duration = Math.max(1, window.end.getTime() - window.start.getTime());
  const previousStart = new Date(window.start.getTime() - duration);
  const bucketCount = 8;
  const result = await client.query(
    `WITH receipts AS (
       SELECT pr."amountCents" AS amount, pr."paidAt" AS paid_at, pr.method
       FROM "paymentRecord" pr
       WHERE pr."organizationId" = $1 AND pr."businessUnit" = 'REEBS_CORE'
         AND LOWER(pr.status) IN ('paid', 'successful', 'confirmed')
         AND pr.currency = 'GHS'
         AND pr."paidAt" >= $4 AND pr."paidAt" < $3
         AND EXISTS (
           SELECT 1 FROM "paymentApplication" pa
           WHERE pa."paymentId" = pr.id AND pa."organizationId" = pr."organizationId"
             AND pa.status = 'APPLIED' AND pa."businessUnit" = 'REEBS_CORE'
             AND pa."payableType" IN ('ORDER', 'BOOKING', 'INVOICE')
         )
         AND NOT EXISTS (
           SELECT 1 FROM "paymentApplication" mixed
           WHERE mixed."paymentId" = pr.id AND mixed."organizationId" = pr."organizationId"
             AND mixed.status = 'APPLIED' AND mixed."businessUnit" <> 'REEBS_CORE'
         )
       UNION ALL
       SELECT op."amountCents", op."paidAt", op.method
       FROM "orderPayment" op
       JOIN "order" o ON o.id = op."orderId" AND o."organizationId" = op."organizationId"
       WHERE op."organizationId" = $1 AND ${coreOrderFilter}
         AND LOWER(COALESCE(op.status, 'successful')) IN ('successful', 'confirmed', 'paid')
         AND o.currency = 'GHS'
         AND op."paidAt" >= $4 AND op."paidAt" < $3
         AND NOT EXISTS (
           SELECT 1 FROM "paymentApplication" linked
           WHERE linked."organizationId" = op."organizationId" AND linked."orderPaymentId" = op.id
         )
     ), bucketed AS (
       SELECT amount, method,
         CASE WHEN paid_at < $2 THEN -1 ELSE
           LEAST(7, FLOOR(EXTRACT(EPOCH FROM (paid_at - $2::timestamptz)) * 1000 / $5)::int)
         END AS bucket
       FROM receipts
     )
     SELECT bucket, COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS count,
       COUNT(*) FILTER (WHERE REGEXP_REPLACE(LOWER(TRIM(COALESCE(method, ''))), '[- ]+', '_', 'g')
         IN ('momo', 'mobile_money', 'mobilemoney')) AS momo_count
     FROM bucketed GROUP BY bucket ORDER BY bucket`,
    [organizationId, window.start.toISOString(), window.end.toISOString(), previousStart.toISOString(), duration / bucketCount]
  );
  const rows = result.rows || [];
  const series = Array.from({ length: bucketCount }, (_, index) => ({
    start: new Date(window.start.getTime() + duration * index / bucketCount).toISOString(),
    end: new Date(window.start.getTime() + duration * (index + 1) / bucketCount).toISOString(),
    amountCents: Number(rows.find((row) => Number(row.bucket) === index)?.amount || 0),
  }));
  const current = rows.filter((row) => Number(row.bucket) >= 0);
  const receivedInWindowCents = series.reduce((sum, point) => sum + point.amountCents, 0);
  const previousCents = Number(rows.find((row) => Number(row.bucket) === -1)?.amount || 0);
  return {
    receivedInWindowCents,
    paymentCount: current.reduce((sum, row) => sum + Number(row.count), 0),
    mobileMoneyPayments: current.reduce((sum, row) => sum + Number(row.momo_count), 0),
    currency: "GHS",
    series,
    comparison: {
      start: previousStart.toISOString(), end: window.start.toISOString(), previousCents,
      changePercent: previousCents > 0 && receivedInWindowCents >= 0
        ? Math.round((receivedInWindowCents - previousCents) / previousCents * 1000) / 10 : null,
    },
  };
};
