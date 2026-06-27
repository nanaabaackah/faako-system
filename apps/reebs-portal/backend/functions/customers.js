/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Filename: customers.js
// Intentionally public lookup paths are restricted to the configured public organization.
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";
import { ensureCrmContactTables } from "./_shared/crmContact.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { resolveConfiguredPublicOrganizationId } from "./_shared/organization.js";
import { requireUser } from "./_shared/userAuth.js";

const publicLookupHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,POST,PUT,DELETE,OPTIONS",
    allowHeaders: "Content-Type, Authorization",
  }),
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CUSTOMER_SEGMENTS = new Set(["prospect", "active", "loyal", "risk"]);
const customerStatusStatements = [
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ`,
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "deletedByUserId" INTEGER`,
  `ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "segmentOverride" TEXT`,
];

let hasEnsuredCustomerStatusColumns = false;
let customerStatusColumnsPromise = null;

const ensureCustomerStatusColumns = async (client) => {
  if (hasEnsuredCustomerStatusColumns) return;

  if (!customerStatusColumnsPromise) {
    customerStatusColumnsPromise = (async () => {
      for (const statement of customerStatusStatements) {
        try {
          await client.query(statement);
        } catch (err) {
          console.warn("Customer status column check failed:", err?.message || err);
        }
      }
      hasEnsuredCustomerStatusColumns = true;
    })().finally(() => {
      customerStatusColumnsPromise = null;
    });
  }

  await customerStatusColumnsPromise;
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: publicLookupHeaders(event),
      body: "",
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureCustomerStatusColumns(client);
    await ensureCrmContactTables(client);
    const authUser = await requireUser(client, event);
    if (!authUser && isCrossSiteBrowserRequest(event)) {
      return {
        statusCode: 403,
        headers: publicLookupHeaders(event),
        body: JSON.stringify({ error: "Cross-site requests are not allowed." }),
      };
    }
    let data = null;
    if (event.httpMethod === "POST" || event.httpMethod === "PUT" || event.httpMethod === "DELETE") {
      try {
        data = JSON.parse(event.body || "{}");
      } catch (err) {
        return {
          statusCode: 400,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Invalid JSON body." }),
        };
      }
    }
    const organizationId = authUser
      ? authUser.organizationId
      : await resolveConfiguredPublicOrganizationId(client);

    const lookupEmail = typeof event.queryStringParameters?.email === "string"
      ? event.queryStringParameters.email.trim()
      : "";
    const lookupPhone = typeof event.queryStringParameters?.phone === "string"
      ? event.queryStringParameters.phone.trim()
      : "";
    const lookupName = typeof event.queryStringParameters?.name === "string"
      ? event.queryStringParameters.name.trim()
      : "";
    const hasLookup = Boolean(lookupEmail || lookupPhone || lookupName);
    const id = Number(event.queryStringParameters?.id || 0);
    const hasId = Number.isFinite(id) && id > 0;
    const compact = String(event.queryStringParameters?.compact || "").trim() === "1";

    if (!authUser) {
      if (event.httpMethod === "PUT") {
        return {
          statusCode: 401,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Unauthorized" }),
        };
      }
      if (event.httpMethod === "DELETE") {
        return {
          statusCode: 401,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Unauthorized" }),
        };
      }
      if (event.httpMethod === "GET" && (hasId || !hasLookup)) {
        return {
          statusCode: 401,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Unauthorized" }),
        };
      }
    }

    // HANDLE POST: Add a new customer
    if (event.httpMethod === "POST") {
      const name = typeof data.name === "string" ? data.name.trim() : "";
      const email =
        typeof data.email === "string" && data.email.trim() ? data.email.trim() : null;
      const phone =
        typeof data.phone === "string" && data.phone.trim() ? data.phone.trim() : null;

      if (!name) {
        return {
          statusCode: 400,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Name is required." }),
        };
      }

      const normalizePhoneVariants = (value) => {
        const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
        if (!digits) return [];
        const variants = new Set([digits]);
        if (digits.startsWith("233") && digits.length >= 12) {
          variants.add(`0${digits.slice(-9)}`);
        }
        if (digits.startsWith("0") && digits.length === 10) {
          variants.add(`233${digits.slice(1)}`);
        }
        return [...variants];
      };
      const phoneVariants = normalizePhoneVariants(phone);

      const respondWith = (row) => ({
        statusCode: 200,
        headers: publicLookupHeaders(event),
        body: JSON.stringify(row),
      });

      const restoreCustomer = async (row) => {
        const restored = await client.query(
          `UPDATE "customer"
           SET "name" = $1,
               "email" = $2,
               "phone" = $3,
               "deletedAt" = NULL,
               "deletedByUserId" = NULL,
               "updatedAt" = NOW()
           WHERE id = $4 AND "organizationId" = $5
           RETURNING id, name, email, phone, "segmentOverride", "createdAt", "updatedAt"`,
          [name, email, phone, row.id, organizationId]
        );
        return restored.rows[0];
      };

      const insertCustomer = async () =>
        email
          ? client.query(
            `INSERT INTO "customer" ("organizationId", "name", "email", "phone", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT ("organizationId", "email") DO UPDATE
             SET "name" = EXCLUDED."name",
                 "phone" = COALESCE(EXCLUDED."phone", "customer"."phone"),
                 "updatedAt" = NOW()
             RETURNING id, name, email, phone, "segmentOverride", "createdAt", "updatedAt"`,
            [organizationId, name, email, phone]
          )
          : client.query(
            `INSERT INTO "customer" ("organizationId", "name", "email", "phone", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id, name, email, phone, "segmentOverride", "createdAt", "updatedAt"`,
            [organizationId, name, email, phone]
          );

      try {
        if (email || phone || name) {
          const existingRes = await client.query(
            `SELECT id, name, email, phone, "segmentOverride", "createdAt", "updatedAt", "deletedAt"
             FROM "customer"
             WHERE "organizationId" = $1
               AND (
                 (LOWER(TRIM(email)) = LOWER(TRIM($2)) AND $2 <> '')
                 OR (regexp_replace(phone, '[^0-9]+', '', 'g') = ANY($3))
                 OR (
                   LOWER(regexp_replace(TRIM(name), '\\s+', ' ', 'g'))
                   = LOWER(regexp_replace(TRIM($4), '\\s+', ' ', 'g'))
                   AND $4 <> ''
                 )
               )
             LIMIT 1`,
            [organizationId, email || "", phoneVariants, name || ""]
          );
          if (existingRes.rowCount > 0) {
            const existingRow = existingRes.rows[0];
            if (existingRow.deletedAt) {
              return respondWith(await restoreCustomer(existingRow));
            }
            return respondWith(existingRow);
          }
        }

        const result = await insertCustomer();
        return respondWith(result.rows[0]);
      } catch (err) {
        if (err?.code === "23505" && err?.constraint === "customer_pkey") {
          const seqRes = await client.query(
            `SELECT pg_get_serial_sequence('"customer"', 'id') AS seq`
          );
          const seqName = seqRes.rows?.[0]?.seq;
          if (seqName) {
            const nextRes = await client.query(
              `SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM "customer"`
            );
            const nextId = Number(nextRes.rows?.[0]?.next_id) || 1;
            await client.query(`SELECT setval($1::regclass, $2, false)`, [
              seqName,
              nextId,
            ]);
            const retry = await insertCustomer();
            return respondWith(retry.rows[0]);
          }
        }
        throw err;
      }
    }

    if (event.httpMethod === "PUT") {
      const id = Number(data.id);
      if (!Number.isFinite(id)) {
        return {
          statusCode: 400,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Customer id is required." }),
        };
      }

      const hasName = Object.prototype.hasOwnProperty.call(data, "name");
      const hasEmail = Object.prototype.hasOwnProperty.call(data, "email");
      const hasPhone = Object.prototype.hasOwnProperty.call(data, "phone");
      const name = typeof data.name === "string" ? data.name.trim() : null;
      const email =
        typeof data.email === "string" && data.email.trim() ? data.email.trim() : null;
      const phone =
        typeof data.phone === "string" && data.phone.trim() ? data.phone.trim() : null;
      const hasSegmentOverride = Object.prototype.hasOwnProperty.call(data, "segmentOverride");

      const updates = [];
      const values = [];
      let index = 1;

      if (hasName) {
        updates.push(`"name" = $${index++}`);
        values.push(name || "");
      }

      if (hasEmail) {
        updates.push(`"email" = $${index++}`);
        values.push(email);
      }

      if (hasPhone) {
        updates.push(`"phone" = $${index++}`);
        values.push(phone);
      }

      if (hasSegmentOverride) {
        let segmentOverride = null;
        if (data.segmentOverride !== null && data.segmentOverride !== "") {
          if (typeof data.segmentOverride !== "string") {
            return {
              statusCode: 400,
              headers: publicLookupHeaders(event),
              body: JSON.stringify({ error: "Invalid customer segment." }),
            };
          }

          segmentOverride = data.segmentOverride.trim().toLowerCase();
          if (!CUSTOMER_SEGMENTS.has(segmentOverride)) {
            return {
              statusCode: 400,
              headers: publicLookupHeaders(event),
              body: JSON.stringify({ error: "Invalid customer segment." }),
            };
          }
        }

        updates.push(`"segmentOverride" = $${index++}`);
        values.push(segmentOverride);
      }

      if (!updates.length) {
        return {
          statusCode: 400,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "No customer updates provided." }),
        };
      }

      updates.push(`"updatedAt" = NOW()`);

      values.push(id);
      values.push(organizationId);

      try {
        const result = await client.query(
          `UPDATE "customer" SET ${updates.join(", ")}
           WHERE id = $${index} AND "organizationId" = $${index + 1} AND "deletedAt" IS NULL
           RETURNING id, name, email, phone, "segmentOverride", "createdAt", "updatedAt"`,
          values
        );

        if (result.rowCount === 0) {
          return {
            statusCode: 404,
            headers: publicLookupHeaders(event),
            body: JSON.stringify({ error: "Customer not found." }),
          };
        }

        return {
          statusCode: 200,
          headers: publicLookupHeaders(event),
          body: JSON.stringify(result.rows[0]),
        };
      } catch (err) {
        if (err?.code === "23505") {
          return {
            statusCode: 409,
            headers: publicLookupHeaders(event),
            body: JSON.stringify({ error: "Duplicate email." }),
          };
        }
        throw err;
      }
    }

    if (event.httpMethod === "DELETE") {
      const id = Number(data?.id);
      if (!Number.isFinite(id)) {
        return {
          statusCode: 400,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Customer id is required." }),
        };
      }

      const result = await client.query(
        `UPDATE "customer"
         SET "deletedAt" = NOW(),
             "deletedByUserId" = $1,
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $3
           AND "deletedAt" IS NULL
         RETURNING id, name, email, phone, "deletedAt"`,
        [Number(authUser.id) || null, id, organizationId]
      );

      if (result.rowCount === 0) {
        return {
          statusCode: 404,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Customer not found." }),
        };
      }

      return {
        statusCode: 200,
        headers: publicLookupHeaders(event),
        body: JSON.stringify(result.rows[0]),
      };
    }

    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: publicLookupHeaders(event),
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    if (hasId) {
      const customerRes = await client.query(
        `SELECT id, name, email, phone, "segmentOverride", "createdAt", "updatedAt"
         FROM "customer"
         WHERE id = $1 AND "organizationId" = $2 AND "deletedAt" IS NULL`,
        [id, organizationId]
      );
      if (customerRes.rowCount === 0) {
        return {
          statusCode: 404,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Customer not found." }),
        };
      }

      const [ordersRes, bookingsRes, contactRequestsRes, activitiesRes] = await Promise.all([
        client.query(
          `SELECT id, "orderNumber", total_amount, "orderDate", "deliveryMethod", "deliveryDetails"
           FROM "order"
           WHERE "customerId" = $1 AND "organizationId" = $2
           ORDER BY "orderDate" DESC`,
          [id, organizationId]
        ),
        client.query(
          `SELECT id, "eventDate", "totalAmount", status
           FROM "booking"
           WHERE "customerId" = $1 AND "organizationId" = $2
           ORDER BY "eventDate" DESC`,
          [id, organizationId]
        ),
        client.query(
          `SELECT id, source, status, priority, topic, "eventDate", location, message,
                  "followUpDueAt", "createdAt", "updatedAt"
           FROM "contactRequest"
           WHERE "customerId" = $1 AND "organizationId" = $2
           ORDER BY "createdAt" DESC
           LIMIT 12`,
          [id, organizationId]
        ),
        client.query(
          `SELECT id, "contactRequestId", type, title, description, status,
                  "dueAt", "completedAt", metadata, "createdAt", "updatedAt"
           FROM "customerActivity"
           WHERE "customerId" = $1 AND "organizationId" = $2
           ORDER BY COALESCE("dueAt", "createdAt") DESC, "createdAt" DESC
           LIMIT 16`,
          [id, organizationId]
        ),
      ]);

      const ordersWithDelivery = (ordersRes.rows || []).map((row) => {
        const { distanceKm, feeCents } = getDeliveryFeeDetails(
          row.deliveryMethod,
          row.deliveryDetails
        );
        const baseCents = Number(row.total_amount || 0);
        const totalWithDelivery = baseCents + feeCents;
        return {
          ...row,
          total_with_delivery: totalWithDelivery,
          delivery_fee: feeCents,
          delivery_distance_km: distanceKm || 0,
        };
      });

      const totalSpent = ordersWithDelivery.reduce(
        (sum, row) => sum + Number(row.total_with_delivery || 0),
        0
      );
      const totalRented = bookingsRes.rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);

      return {
        statusCode: 200,
        headers: publicLookupHeaders(event),
        body: JSON.stringify({
          customer: customerRes.rows[0],
          orders: ordersWithDelivery,
          bookings: bookingsRes.rows,
          totals: {
            orders: ordersRes.rows.length,
            bookings: bookingsRes.rows.length,
            contactRequests: contactRequestsRes.rows.length,
            openContactRequests: contactRequestsRes.rows.filter((row) => row.status !== "closed").length,
            totalSpent,
            totalRented,
          },
          contactRequests: contactRequestsRes.rows,
          activities: activitiesRes.rows,
        }),
      };
    }

    const normalizePhoneVariants = (value) => {
      const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
      if (!digits) return [];
      const variants = new Set([digits]);
      if (digits.startsWith("233") && digits.length >= 12) {
        variants.add(`0${digits.slice(-9)}`);
      }
      if (digits.startsWith("0") && digits.length === 10) {
        variants.add(`233${digits.slice(1)}`);
      }
      return [...variants];
    };
    const lookupPhoneVariants = normalizePhoneVariants(lookupPhone);

    if (hasLookup && !hasId) {
      if (!authUser) {
        const lookupPhoneDigits = lookupPhone.replace(/\D/g, "");
        const invalidPublicLookup = (
          (lookupEmail && !EMAIL_PATTERN.test(lookupEmail))
          || (lookupPhone && lookupPhoneDigits.length < 9)
          || (lookupName && lookupName.length < 3)
        );

        if (invalidPublicLookup) {
          return {
            statusCode: 400,
            headers: publicLookupHeaders(event),
            body: JSON.stringify({ error: "Enter a valid customer lookup value." }),
          };
        }
      }

      let match = null;
      if (lookupEmail) {
        const res = await client.query(
          `SELECT id, name, email, phone, "createdAt", "updatedAt"
           FROM "customer"
           WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
             AND "organizationId" = $2
             AND "deletedAt" IS NULL
           LIMIT 1`,
          [lookupEmail, organizationId]
        );
        match = res.rows[0] || null;
      }
      if (!match && lookupPhone) {
        const res = await client.query(
          `SELECT id, name, email, phone, "createdAt", "updatedAt"
           FROM "customer"
           WHERE regexp_replace(phone, '[^0-9]+', '', 'g') = ANY($1)
             AND "organizationId" = $2
             AND "deletedAt" IS NULL
           LIMIT 1`,
          [lookupPhoneVariants, organizationId]
        );
        match = res.rows[0] || null;
      }
      if (!match && lookupName) {
        const res = await client.query(
          `SELECT id, name, email, phone, "createdAt", "updatedAt"
           FROM "customer"
           WHERE LOWER(regexp_replace(TRIM(name), '\\s+', ' ', 'g'))
                 = LOWER(regexp_replace(TRIM($1), '\\s+', ' ', 'g'))
              AND "organizationId" = $2
              AND "deletedAt" IS NULL
           LIMIT 1`,
          [lookupName, organizationId]
        );
        match = res.rows[0] || null;
      }

      if (!match) {
        return {
          statusCode: 404,
          headers: publicLookupHeaders(event),
          body: JSON.stringify({ error: "Customer not found." }),
        };
      }

      const publicCustomer = authUser
        ? match
        : {
          id: match.id,
          name: match.name,
        };

      return {
        statusCode: 200,
        headers: publicLookupHeaders(event),
        body: JSON.stringify(publicCustomer),
      };
    }

    if (compact) {
      const compactResult = await client.query(
        `SELECT id, name, email, phone, "segmentOverride", "createdAt", "updatedAt"
         FROM "customer"
         WHERE "organizationId" = $1
           AND "deletedAt" IS NULL
         ORDER BY name ASC`,
        [organizationId]
      );
      return {
        statusCode: 200,
        headers: publicLookupHeaders(event),
        body: JSON.stringify(compactResult.rows),
      };
    }

    // HANDLE GET: List all customers with stats
    const result = await client.query(
       `SELECT
         c.id,
         c.name,
         c.email,
         c.phone,
         c."segmentOverride",
         c."createdAt",
         c."updatedAt",
         COALESCE(o.orders, 0)::int AS orders,
         COALESCE(b.bookings, 0)::int AS bookings,
         COALESCE(o.total_spent, 0) AS total_spent,
         COALESCE(b.total_rented, 0) AS total_rented,
         COALESCE(cr.contact_requests, 0)::int AS contact_requests,
         COALESCE(cr.open_contact_requests, 0)::int AS open_contact_requests,
         o.last_order_date,
         b.last_booking_date,
         cr.last_contact_request_at,
         cr.next_follow_up_due_at,
         NULLIF(
           GREATEST(
             COALESCE(o.last_order_date, TIMESTAMP 'epoch'),
             COALESCE(b.last_booking_date, TIMESTAMP 'epoch'),
             COALESCE(cr.last_contact_request_at, TIMESTAMP 'epoch')
           ),
           TIMESTAMP 'epoch'
         ) AS last_activity_at
       FROM "customer" c
       LEFT JOIN (
         SELECT
           "customerId",
           COUNT(*) AS orders,
           COALESCE(SUM(total_amount), 0) AS total_spent,
           MAX("orderDate") AS last_order_date
         FROM "order"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) o ON o."customerId" = c.id
       LEFT JOIN (
         SELECT
           "customerId",
           COUNT(*) AS bookings,
           COALESCE(SUM("totalAmount"), 0) AS total_rented,
           MAX("eventDate") AS last_booking_date
         FROM "booking"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) b ON b."customerId" = c.id
       LEFT JOIN (
         SELECT
           "customerId",
           COUNT(*) AS contact_requests,
           COUNT(*) FILTER (WHERE status NOT IN ('closed', 'converted', 'spam')) AS open_contact_requests,
           MAX("createdAt") AS last_contact_request_at,
           MIN("followUpDueAt") FILTER (WHERE status NOT IN ('closed', 'converted', 'spam')) AS next_follow_up_due_at
         FROM "contactRequest"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) cr ON cr."customerId" = c.id
       WHERE c."organizationId" = $1
         AND c."deletedAt" IS NULL
       ORDER BY c.name ASC`,
      [organizationId]
    );
    return {
      statusCode: 200,
      headers: publicLookupHeaders(event),
      body: JSON.stringify(result.rows),
    };

  } catch (err) {
    console.error("❌ Database error:", err);
    return {
      statusCode: 500,
      headers: publicLookupHeaders(event),
      body: JSON.stringify({ error: err.message || "Database error" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
