import { toPaymentAdminDto, toUniversalPaymentAdminDto } from "./paymentDomain.js";

const clampPageSize = (value) => Math.min(100, Math.max(10, Number(value) || 25));
const normalizePage = (value) => Math.max(1, Number(value) || 1);

export const listCorePayments = async (client, { organizationId, query = {} }) => {
  await client.query("SELECT set_config('app.current_organization_id', $1, false)", [String(organizationId)]);
  const foundationResult = await client.query(
    `SELECT to_regclass('public."paymentRecord"') IS NOT NULL
       AND to_regclass('public."paymentApplication"') IS NOT NULL AS available`
  );
  if (foundationResult.rows?.[0]?.available) {
    return listCoreUniversalPayments(client, { organizationId, query });
  }
  const page = normalizePage(query.page);
  const pageSize = clampPageSize(query.pageSize || query.limit);
  const params = [organizationId];
  const where = [
    `p."organizationId" = $1`,
    `COALESCE(o."businessUnit", 'REEBS_CORE') = 'REEBS_CORE'`,
  ];
  const search = String(query.q || query.search || "").trim().toLowerCase().slice(0, 160);
  if (search) {
    params.push(`%${search}%`);
    const key = `$${params.length}`;
    where.push(`(
      LOWER('REEBS-PAY-' || LPAD(p.id::text, 6, '0')) LIKE ${key}
      OR LOWER(COALESCE(p."transactionReference", '')) LIKE ${key}
      OR LOWER(COALESCE(o."orderNumber", '')) LIKE ${key}
      OR LOWER(COALESCE(o."customerName", '')) LIKE ${key}
      OR LOWER(COALESCE(c.phone, '')) LIKE ${key}
    )`);
  }
  if (query.status && query.status !== "all") {
    params.push(String(query.status).trim().toLowerCase());
    where.push(`LOWER(COALESCE(p.status, 'successful')) = $${params.length}`);
  }
  if (query.method && query.method !== "all") {
    params.push(String(query.method).trim().toLowerCase());
    where.push(`CASE
      WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(p.method, ''))), '[- ]+', '_', 'g')
        IN ('momo', 'mobile_money', 'mobilemoney') THEN 'mobile_money'
      WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(p.method, ''))), '[- ]+', '_', 'g')
        IN ('bank', 'bank_transfer', 'transfer') THEN 'bank_transfer'
      WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(p.method, ''))), '[- ]+', '_', 'g')
        IN ('card', 'credit_card', 'debit_card') THEN 'card'
      ELSE REGEXP_REPLACE(LOWER(TRIM(COALESCE(p.method, ''))), '[- ]+', '_', 'g')
    END = $${params.length}`);
  }

  const countResult = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM "orderPayment" p
     JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId"
     LEFT JOIN "customer" c ON c.id = p."customerId" AND c."organizationId" = p."organizationId"
     WHERE ${where.join(" AND ")}`,
    params
  );
  params.push(pageSize, (page - 1) * pageSize);
  const rowsResult = await client.query(
    `SELECT
       p.id, p."orderId", p."customerId", p."amountCents", p.method, p.provider,
       p."transactionReference", p."confirmationStatus", p.status, p."paidAt",
       p."recordedByUserId", p.notes, p."createdAt",
       o."orderNumber", o.currency, o."customerName", c.phone AS "customerPhone"
     FROM "orderPayment" p
     JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId"
     LEFT JOIN "customer" c ON c.id = p."customerId" AND c."organizationId" = p."organizationId"
     WHERE ${where.join(" AND ")}
     ORDER BY p."paidAt" DESC, p.id DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const total = Number(countResult.rows?.[0]?.count || 0);
  return {
    items: (rowsResult.rows || []).map(toPaymentAdminDto),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    businessUnit: "REEBS_CORE",
  };
};

const listCoreUniversalPayments = async (client, { organizationId, query = {} }) => {
  const page = normalizePage(query.page);
  const pageSize = clampPageSize(query.pageSize || query.limit);
  const params = [organizationId];
  const where = [`register."businessUnit" = 'REEBS_CORE'`];
  const search = String(query.q || query.search || "").trim().toLowerCase().slice(0, 160);
  if (search) {
    params.push(`%${search}%`);
    const key = `$${params.length}`;
    where.push(`(
      LOWER(register."paymentReference") LIKE ${key}
      OR LOWER(COALESCE(register."providerReference", '')) LIKE ${key}
      OR LOWER(COALESCE(register."payableReference", '')) LIKE ${key}
      OR LOWER(COALESCE(register."customerName", '')) LIKE ${key}
      OR LOWER(COALESCE(register."customerPhone", '')) LIKE ${key}
    )`);
  }
  if (query.status && query.status !== "all") {
    const status = String(query.status).trim().toLowerCase();
    params.push(status === "successful" ? "paid" : status);
    where.push(`LOWER(register.status) = $${params.length}`);
  }
  if (query.method && query.method !== "all") {
    params.push(String(query.method).trim().toLowerCase());
    where.push(`CASE
      WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(register.method, ''))), '[- ]+', '_', 'g')
        IN ('momo', 'mobile_money', 'mobilemoney') THEN 'mobile_money'
      WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(register.method, ''))), '[- ]+', '_', 'g')
        IN ('bank', 'bank_transfer', 'transfer') THEN 'bank_transfer'
      WHEN REGEXP_REPLACE(LOWER(TRIM(COALESCE(register.method, ''))), '[- ]+', '_', 'g')
        IN ('card', 'credit_card', 'debit_card') THEN 'card'
      ELSE REGEXP_REPLACE(LOWER(TRIM(COALESCE(register.method, ''))), '[- ]+', '_', 'g')
    END = $${params.length}`);
  }

  const registerCte = `WITH register AS (
    SELECT
      ('payment:' || pr.id)::text AS "rowKey", pr.id, pr.reference AS "paymentReference",
      pr."amountCents", pr.currency, pr.method, pr.provider, pr."providerReference",
      pr."verificationStatus", pr.source, pr.status, pr."paidAt", pr."createdAt",
      pr."recordedByUserId", pr.notes, pr."businessUnit", pr."customerId",
      c.name AS "customerName", c.phone AS "customerPhone",
      pa."payableType", pa."payableId",
      CASE pa."payableType"
        WHEN 'ORDER' THEN o."orderNumber"
        WHEN 'BOOKING' THEN b.reference
        WHEN 'INVOICE' THEN 'Invoice #' || pa."payableId"::text
        ELSE pa."payableType" || ' #' || pa."payableId"::text
      END AS "payableReference"
    FROM "paymentRecord" pr
    JOIN "paymentApplication" pa
      ON pa."paymentId" = pr.id AND pa."organizationId" = pr."organizationId" AND pa.status = 'APPLIED'
    LEFT JOIN "customer" c ON c.id = pr."customerId" AND c."organizationId" = pr."organizationId"
    LEFT JOIN "order" o ON pa."payableType" = 'ORDER' AND o.id = pa."payableId" AND o."organizationId" = pr."organizationId"
    LEFT JOIN "booking" b ON pa."payableType" = 'BOOKING' AND b.id = pa."payableId" AND b."organizationId" = pr."organizationId"
    WHERE pr."organizationId" = $1 AND pr."businessUnit" = 'REEBS_CORE'

    UNION ALL

    SELECT
      ('legacy:' || p.id)::text AS "rowKey", p.id,
      ('REEBS-PAY-' || LPAD(p.id::text, 6, '0')) AS "paymentReference",
      p."amountCents", o.currency, p.method, p.provider,
      p."transactionReference" AS "providerReference",
      CASE WHEN LOWER(COALESCE(p."confirmationStatus", '')) = 'provider_verified'
        THEN 'PROVIDER_VERIFIED' ELSE 'MANUAL_RECORDED' END AS "verificationStatus",
      CASE WHEN LOWER(COALESCE(p."confirmationStatus", '')) = 'provider_verified'
        THEN 'ONLINE_PROVIDER' ELSE 'MANUAL' END AS source,
      CASE WHEN LOWER(COALESCE(p.status, 'successful')) IN ('successful','confirmed','paid')
        THEN 'paid' ELSE LOWER(COALESCE(p.status, 'pending')) END AS status,
      p."paidAt", p."createdAt", p."recordedByUserId", p.notes,
      'REEBS_CORE' AS "businessUnit", p."customerId", o."customerName", c.phone AS "customerPhone",
      'ORDER' AS "payableType", p."orderId" AS "payableId", o."orderNumber" AS "payableReference"
    FROM "orderPayment" p
    JOIN "order" o ON o.id = p."orderId" AND o."organizationId" = p."organizationId"
    LEFT JOIN "customer" c ON c.id = p."customerId" AND c."organizationId" = p."organizationId"
    WHERE p."organizationId" = $1
      AND COALESCE(o."businessUnit", 'REEBS_CORE') = 'REEBS_CORE'
      AND NOT EXISTS (
        SELECT 1 FROM "paymentApplication" linked
        WHERE linked."organizationId" = p."organizationId" AND linked."orderPaymentId" = p.id
      )
  )`;
  const whereSql = where.join(" AND ");
  const countResult = await client.query(
    `${registerCte} SELECT COUNT(*)::int AS count FROM register WHERE ${whereSql}`,
    params
  );
  const listParams = [...params, pageSize, (page - 1) * pageSize];
  const rowsResult = await client.query(
    `${registerCte}
     SELECT * FROM register
     WHERE ${whereSql}
     ORDER BY "paidAt" DESC, id DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );
  const total = Number(countResult.rows?.[0]?.count || 0);
  return {
    items: (rowsResult.rows || []).map(toUniversalPaymentAdminDto),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    businessUnit: "REEBS_CORE",
  };
};
