export const CUSTOMER_SELECT = `
  c.id,
  c."organizationId",
  c.reference,
  c."customerType",
  c.name,
  c."organizationName",
  c."contactPersonName",
  c.email,
  c.phone,
  c."secondaryPhone",
  c."addressLine1",
  c."addressLine2",
  c.locality,
  c.region,
  c."ghanaPostGps",
  c."preferredContactMethod",
  c."segmentOverride",
  c."deletedAt",
  c."createdAt",
  c."updatedAt"
`;

const buildListWhere = ({
  organizationId,
  query = "",
  normalizedEmail = null,
  normalizedPhone = null,
  customerType = "",
  status = "active",
}) => {
  const values = [organizationId];
  const clauses = [`c."organizationId" = $1`];
  if (status === "archived") clauses.push(`c."deletedAt" IS NOT NULL`);
  else clauses.push(`c."deletedAt" IS NULL`);

  if (["individual", "organization"].includes(customerType)) {
    values.push(customerType);
    clauses.push(`c."customerType" = $${values.length}`);
  }

  if (query) {
    values.push(`%${query}%`);
    const parameter = `$${values.length}`;
    values.push(normalizedEmail);
    const emailParameter = `$${values.length}`;
    values.push(normalizedPhone);
    const phoneParameter = `$${values.length}`;
    clauses.push(`(
      c.name ILIKE ${parameter}
      OR c."organizationName" ILIKE ${parameter}
      OR c."contactPersonName" ILIKE ${parameter}
      OR c.email ILIKE ${parameter}
      OR c.phone ILIKE ${parameter}
      OR c.reference ILIKE ${parameter}
      OR c."ghanaPostGps" ILIKE ${parameter}
      OR (${emailParameter}::text IS NOT NULL AND c."normalizedEmail" = ${emailParameter})
      OR (${phoneParameter}::text IS NOT NULL AND c."normalizedPhone" = ${phoneParameter})
    )`);
  }
  return { sql: clauses.join(" AND "), values };
};

export async function listCompactCustomers(client, organizationId, {
  query = "",
  normalizedEmail = null,
  normalizedPhone = null,
  limit = 100,
} = {}) {
  const where = buildListWhere({ organizationId, query, normalizedEmail, normalizedPhone, status: "active" });
  where.values.push(Math.min(200, Math.max(10, Number(limit) || 100)));
  const result = await client.query(
    `SELECT ${CUSTOMER_SELECT}
     FROM "customer" c
     WHERE ${where.sql}
     ORDER BY c.name ASC, c.id ASC
     LIMIT $${where.values.length}`,
    where.values
  );
  return result.rows || [];
}

export async function listCustomers(client, organizationId, {
  query = "",
  normalizedEmail = null,
  normalizedPhone = null,
  customerType = "",
  status = "active",
  scope = "core",
  includeFinancials = false,
  pageSize = 25,
  offset = 0,
} = {}) {
  const where = buildListWhere({ organizationId, query, normalizedEmail, normalizedPhone, customerType, status });
  const countResult = await client.query(
    `SELECT COUNT(*)::int AS total FROM "customer" c WHERE ${where.sql}`,
    where.values
  );
  const total = Number(countResult.rows?.[0]?.total || 0);
  const values = [...where.values, pageSize, offset];
  const listParameters = `LIMIT $${values.length - 1} OFFSET $${values.length}`;

  const commercialJoins = scope === "water"
    ? `LEFT JOIN (
         SELECT "customerId", COUNT(*)::int AS water_sales, COALESCE(SUM("totalAmount"), 0) AS water_revenue,
                MAX(date) AS last_water_sale_at
         FROM "waterSale"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) w ON w."customerId" = c.id`
    : `LEFT JOIN (
         SELECT "customerId", COUNT(*)::int AS orders,
                ${includeFinancials ? `COALESCE(SUM(COALESCE("grandTotalCents", total_amount + COALESCE("deliveryFeeCents", 0))), 0)` : "NULL::bigint"} AS total_spent,
                MAX("orderDate") AS last_order_date
         FROM "order"
         WHERE "organizationId" = $1 AND COALESCE("businessUnit", 'REEBS_CORE') = 'REEBS_CORE'
         GROUP BY "customerId"
       ) o ON o."customerId" = c.id
       LEFT JOIN (
         SELECT "customerId", COUNT(*)::int AS bookings,
                ${includeFinancials ? `COALESCE(SUM("totalAmount"), 0)` : "NULL::bigint"} AS total_rented,
                MAX("eventDate") AS last_booking_date
         FROM "booking"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) b ON b."customerId" = c.id
       LEFT JOIN (
         SELECT "customerId", COUNT(*)::int AS contact_requests,
                COUNT(*) FILTER (WHERE status NOT IN ('closed', 'converted', 'spam'))::int AS open_contact_requests,
                MAX("createdAt") AS last_contact_request_at,
                MIN("followUpDueAt") FILTER (WHERE status NOT IN ('closed', 'converted', 'spam')) AS next_follow_up_due_at
         FROM "contactRequest"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) cr ON cr."customerId" = c.id`;

  const commercialSelect = scope === "water"
    ? `COALESCE(w.water_sales, 0)::int AS water_sales,
       COALESCE(w.water_revenue, 0) AS water_revenue,
       w.last_water_sale_at AS last_activity_at`
    : `COALESCE(o.orders, 0)::int AS orders,
       COALESCE(b.bookings, 0)::int AS bookings,
       ${includeFinancials ? "COALESCE(o.total_spent, 0)" : "NULL::bigint"} AS total_spent,
       ${includeFinancials ? "COALESCE(b.total_rented, 0)" : "NULL::bigint"} AS total_rented,
       COALESCE(cr.contact_requests, 0)::int AS contact_requests,
       COALESCE(cr.open_contact_requests, 0)::int AS open_contact_requests,
       cr.next_follow_up_due_at,
       NULLIF(GREATEST(
         COALESCE(o.last_order_date, TIMESTAMP 'epoch'),
         COALESCE(b.last_booking_date, TIMESTAMP 'epoch'),
         COALESCE(cr.last_contact_request_at, TIMESTAMP 'epoch')
       ), TIMESTAMP 'epoch') AS last_activity_at`;

  const result = await client.query(
    `SELECT ${CUSTOMER_SELECT}, ${commercialSelect}
     FROM "customer" c
     ${commercialJoins}
     WHERE ${where.sql}
     ORDER BY last_activity_at DESC NULLS LAST, c.name ASC, c.id ASC
     ${listParameters}`,
    values
  );
  return { rows: result.rows || [], total };
}

export async function findCustomerById(client, organizationId, customerId, {
  includeInternalNotes = false,
  includeArchived = false,
} = {}) {
  const result = await client.query(
    `SELECT ${CUSTOMER_SELECT}${includeInternalNotes ? `, c."internalNotes"` : ""}
     FROM "customer" c
     WHERE c.id = $1 AND c."organizationId" = $2 ${includeArchived ? "" : `AND c."deletedAt" IS NULL`}
     LIMIT 1`,
    [customerId, organizationId]
  );
  return result.rows[0] || null;
}

export async function findCustomerDuplicates(client, organizationId, input, {
  excludeId = null,
  includeArchived = false,
} = {}) {
  const values = [organizationId, input.normalizedEmail, input.normalizedPhone, input.organizationName];
  let excludeClause = "";
  if (Number.isInteger(Number(excludeId)) && Number(excludeId) > 0) {
    values.push(Number(excludeId));
    excludeClause = `AND c.id <> $${values.length}`;
  }
  const result = await client.query(
    `SELECT ${CUSTOMER_SELECT},
            CASE
              WHEN $2::text IS NOT NULL AND c."normalizedEmail" = $2 THEN 'exact_email'
              WHEN $3::text IS NOT NULL AND c."normalizedPhone" = $3 THEN 'exact_phone'
              ELSE 'likely_organization'
            END AS "matchReason"
     FROM "customer" c
     WHERE c."organizationId" = $1
       ${includeArchived ? "" : `AND c."deletedAt" IS NULL`}
       ${excludeClause}
       AND (
         ($2::text IS NOT NULL AND c."normalizedEmail" = $2)
         OR ($3::text IS NOT NULL AND c."normalizedPhone" = $3)
         OR ($4::text IS NOT NULL AND c."customerType" = 'organization'
             AND LOWER(c."organizationName") = LOWER($4))
       )
     ORDER BY c.id ASC
     LIMIT 5`,
    values
  );
  return result.rows || [];
}

export async function createCustomer(client, organizationId, input) {
  const result = await client.query(
    `WITH next_customer AS (
       SELECT nextval(pg_get_serial_sequence('"customer"', 'id'))::int AS id
     )
     INSERT INTO "customer" (
       id, "organizationId", reference, "customerType", name, "organizationName", "contactPersonName",
       email, "normalizedEmail", phone, "normalizedPhone", "secondaryPhone", "normalizedSecondaryPhone",
       "addressLine1", "addressLine2", locality, region, "ghanaPostGps", "preferredContactMethod",
       "internalNotes", "createdAt", "updatedAt"
     )
     SELECT
       next_customer.id, $1, 'CUS-' || LPAD(next_customer.id::text, 6, '0'),
       $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16, $17, $18, NOW(), NOW()
     FROM next_customer
     RETURNING id`,
    [
      organizationId, input.customerType, input.name, input.organizationName, input.contactPersonName,
      input.email, input.normalizedEmail, input.phone, input.normalizedPhone, input.secondaryPhone,
      input.normalizedSecondaryPhone, input.addressLine1, input.addressLine2, input.locality, input.region,
      input.ghanaPostGps, input.preferredContactMethod, input.internalNotes,
    ]
  );
  const customerId = Number(result.rows[0].id);
  return findCustomerById(client, organizationId, customerId, { includeInternalNotes: true });
}

export async function updateCustomer(client, organizationId, customerId, input, { segmentOverride = undefined } = {}) {
  const values = [
    input.customerType, input.name, input.organizationName, input.contactPersonName,
    input.email, input.normalizedEmail, input.phone, input.normalizedPhone, input.secondaryPhone,
    input.normalizedSecondaryPhone, input.addressLine1, input.addressLine2, input.locality, input.region,
    input.ghanaPostGps, input.preferredContactMethod, input.internalNotes,
  ];
  let segmentSql = "";
  if (segmentOverride !== undefined) {
    values.push(segmentOverride);
    segmentSql = `, "segmentOverride" = $${values.length}`;
  }
  values.push(customerId, organizationId);
  const result = await client.query(
    `UPDATE "customer" SET
       "customerType" = $1, name = $2, "organizationName" = $3, "contactPersonName" = $4,
       email = $5, "normalizedEmail" = $6, phone = $7, "normalizedPhone" = $8,
       "secondaryPhone" = $9, "normalizedSecondaryPhone" = $10, "addressLine1" = $11,
       "addressLine2" = $12, locality = $13, region = $14, "ghanaPostGps" = $15,
       "preferredContactMethod" = $16, "internalNotes" = $17${segmentSql}, "updatedAt" = NOW()
     WHERE id = $${values.length - 1} AND "organizationId" = $${values.length} AND "deletedAt" IS NULL
     RETURNING id`,
    values
  );
  if (!result.rowCount) return null;
  return findCustomerById(client, organizationId, customerId, { includeInternalNotes: true });
}

export async function archiveCustomer(client, organizationId, customerId, userId) {
  const result = await client.query(
    `UPDATE "customer"
     SET "deletedAt" = NOW(), "deletedByUserId" = $1, "updatedAt" = NOW()
     WHERE id = $2 AND "organizationId" = $3 AND "deletedAt" IS NULL
     RETURNING id, reference, name, "deletedAt"`,
    [userId || null, customerId, organizationId]
  );
  return result.rows[0] || null;
}

export async function reactivateCustomer(client, organizationId, customerId) {
  const result = await client.query(
    `UPDATE "customer"
     SET "deletedAt" = NULL, "deletedByUserId" = NULL, "updatedAt" = NOW()
     WHERE id = $1 AND "organizationId" = $2 AND "deletedAt" IS NOT NULL
     RETURNING id`,
    [customerId, organizationId]
  );
  if (!result.rowCount) return null;
  return findCustomerById(client, organizationId, customerId, { includeInternalNotes: true });
}
