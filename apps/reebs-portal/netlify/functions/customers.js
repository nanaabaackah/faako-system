/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// Filename: customers.js
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getDeliveryFeeDetails } from "./_shared/deliveryFee.js";
import { buildResponseHeaders, isCrossSiteBrowserRequest } from "./_shared/http.js";
import { resolveOrganizationId } from "./_shared/organization.js";
import { requireUser } from "./_shared/userAuth.js";

const publicLookupHeaders = (event) => ({
  "Content-Type": "application/json",
  ...buildResponseHeaders(event, {
    methods: "GET,POST,PUT,OPTIONS",
    allowHeaders: "Content-Type, Authorization",
  }),
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
      },
      body: "",
    };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authUser = await requireUser(client, event);
    if (!authUser && isCrossSiteBrowserRequest(event)) {
      return {
        statusCode: 403,
        headers: publicLookupHeaders(event),
        body: JSON.stringify({ error: "Cross-site requests are not allowed." }),
      };
    }
    let data = null;
    if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
      try {
        data = JSON.parse(event.body || "{}");
      } catch (err) {
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Invalid JSON body." }),
        };
      }
    }
    const organizationId = authUser
      ? authUser.organizationId
      : await resolveOrganizationId(client, event, data);

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

    if (!authUser) {
      if (event.httpMethod === "PUT") {
        return {
          statusCode: 401,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Unauthorized" }),
        };
      }
      if (event.httpMethod === "GET" && (hasId || !hasLookup)) {
        return {
          statusCode: 401,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(row),
      });

      const insertCustomer = async () =>
        email
          ? client.query(
            `INSERT INTO "customer" ("organizationId", "name", "email", "phone", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             ON CONFLICT ("organizationId", "email") DO UPDATE
             SET "name" = EXCLUDED."name",
                 "phone" = COALESCE(EXCLUDED."phone", "customer"."phone"),
                 "updatedAt" = NOW()
             RETURNING id, name, email, phone, "createdAt", "updatedAt"`,
            [organizationId, name, email, phone]
          )
          : client.query(
            `INSERT INTO "customer" ("organizationId", "name", "email", "phone", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING id, name, email, phone, "createdAt", "updatedAt"`,
            [organizationId, name, email, phone]
          );

      try {
        if (email || phone || name) {
          const existingRes = await client.query(
            `SELECT id, name, email, phone, "createdAt", "updatedAt"
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
            return respondWith(existingRes.rows[0]);
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
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Customer id is required." }),
        };
      }

      const name = typeof data.name === "string" ? data.name.trim() : null;
      const email =
        typeof data.email === "string" && data.email.trim() ? data.email.trim() : null;
      const phone =
        typeof data.phone === "string" && data.phone.trim() ? data.phone.trim() : null;

      const updates = [];
      const values = [];
      let index = 1;

      if (name !== null) {
        updates.push(`"name" = $${index++}`);
        values.push(name || "");
      }

      updates.push(`"email" = $${index++}`);
      values.push(email);

      updates.push(`"phone" = $${index++}`);
      values.push(phone);

      updates.push(`"updatedAt" = NOW()`);

      values.push(id);
      values.push(organizationId);

      try {
        const result = await client.query(
          `UPDATE "customer" SET ${updates.join(", ")}
           WHERE id = $${index} AND "organizationId" = $${index + 1}
           RETURNING id, name, email, phone, "createdAt", "updatedAt"`,
          values
        );

        if (result.rowCount === 0) {
          return {
            statusCode: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "Customer not found." }),
          };
        }

        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(result.rows[0]),
        };
      } catch (err) {
        if (err?.code === "23505") {
          return {
            statusCode: 409,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "Duplicate email." }),
          };
        }
        throw err;
      }
    }

    if (event.httpMethod !== "GET") {
      return {
        statusCode: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        },
        body: JSON.stringify({ error: "Method Not Allowed" }),
      };
    }

    if (hasId) {
      const customerRes = await client.query(
        `SELECT id, name, email, phone, "createdAt", "updatedAt"
         FROM "customer"
         WHERE id = $1 AND "organizationId" = $2`,
        [id, organizationId]
      );
      if (customerRes.rowCount === 0) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: "Customer not found." }),
        };
      }

      const [ordersRes, bookingsRes] = await Promise.all([
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
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          customer: customerRes.rows[0],
          orders: ordersWithDelivery,
          bookings: bookingsRes.rows,
          totals: {
            orders: ordersRes.rows.length,
            bookings: bookingsRes.rows.length,
            totalSpent,
            totalRented,
          },
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
        headers: authUser
          ? { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          : publicLookupHeaders(event),
        body: JSON.stringify(publicCustomer),
      };
    }

    // HANDLE GET: List all customers with stats
    const result = await client.query(
      `SELECT
         c.id,
         c.name,
         c.email,
         c.phone,
         c."createdAt",
         c."updatedAt",
         COALESCE(o.orders, 0)::int AS orders,
         COALESCE(b.bookings, 0)::int AS bookings,
         COALESCE(o.total_spent, 0) AS total_spent,
         COALESCE(b.total_rented, 0) AS total_rented
       FROM "customer" c
       LEFT JOIN (
         SELECT "customerId", COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS total_spent
         FROM "order"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) o ON o."customerId" = c.id
       LEFT JOIN (
         SELECT "customerId", COUNT(*) AS bookings, COALESCE(SUM("totalAmount"), 0) AS total_rented
         FROM "booking"
         WHERE "organizationId" = $1
         GROUP BY "customerId"
       ) b ON b."customerId" = c.id
       WHERE c."organizationId" = $1
       ORDER BY c.name ASC`,
      [organizationId]
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify(result.rows),
    };

  } catch (err) {
    console.error("❌ Database error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Database error" }),
    };
  } finally {
    await client.end().catch(() => {});
  }
}
