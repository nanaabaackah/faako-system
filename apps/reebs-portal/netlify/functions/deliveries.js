/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const json = (event, statusCode, body) =>
  respond(event, statusCode, body, { methods: "GET,POST,PUT,OPTIONS" });

const tableStatements = [
  `CREATE TABLE IF NOT EXISTS "delivery" (
    "id" SERIAL PRIMARY KEY,
    "bookingId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "driverName" TEXT,
    "routeGroup" TEXT,
    "routeOrder" INTEGER,
    "eta" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'scheduled'`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "driverName" TEXT`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "routeGroup" TEXT`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "routeOrder" INTEGER`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "eta" TEXT`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "delivery" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "delivery_bookingId_key" ON "delivery" ("bookingId")`,
  `CREATE INDEX IF NOT EXISTS "delivery_status_idx" ON "delivery" ("status")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'delivery_bookingId_fkey'
     ) THEN
       ALTER TABLE "delivery"
         ADD CONSTRAINT "delivery_bookingId_fkey"
         FOREIGN KEY ("bookingId") REFERENCES "booking"("id")
         ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END $$;`,
];

const ensureDeliveryTable = async (client) => {
  for (const statement of tableStatements) {
    try {
      await client.query(statement);
    } catch (err) {
      console.warn("Delivery table check failed:", err?.message || err);
    }
  }
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const resolveAvailableDriver = async (client, bookingId, organizationId) => {
  const bookingRes = await client.query(
    `SELECT "eventDate", "assignedUserId"
     FROM "booking"
     WHERE id = $1 AND "organizationId" = $2`,
    [bookingId, organizationId]
  );
  if (bookingRes.rowCount === 0) return null;
  const booking = bookingRes.rows[0];

  if (booking.assignedUserId) {
    const assignedRes = await client.query(
      `SELECT "fullName", role
       FROM "user"
       WHERE id = $1 AND "organizationId" = $2`,
      [booking.assignedUserId, organizationId]
    );
    const assigned = assignedRes.rows[0];
    if (assigned && String(assigned.role || "").toLowerCase() === "driver") {
      return assigned.fullName || null;
    }
  }

  const driversRes = await client.query(
    `SELECT id, "fullName"
     FROM "user"
     WHERE "organizationId" = $1
       AND LOWER(role) = 'driver'
     ORDER BY "fullName" ASC`,
    [organizationId]
  );
  if (driversRes.rowCount === 0) return null;

  const assignmentsRes = await client.query(
    `SELECT d."driverName", COUNT(*)::int AS total
     FROM "delivery" d
     JOIN "booking" b ON b.id = d."bookingId"
     WHERE b."organizationId" = $1
       AND b."eventDate"::date = $2::date
       AND COALESCE(b.status, '') NOT ILIKE 'cancelled'
       AND d."driverName" IS NOT NULL
     GROUP BY d."driverName"`,
    [organizationId, booking.eventDate]
  );
  const assignments = new Map(
    (assignmentsRes.rows || []).map((row) => [row.driverName, Number(row.total) || 0])
  );

  let chosen = null;
  let lowestCount = Infinity;
  for (const driver of driversRes.rows || []) {
    const count = assignments.get(driver.fullName) || 0;
    if (count < lowestCount) {
      lowestCount = count;
      chosen = driver.fullName;
    }
  }

  return chosen;
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return json(event, 204, {});
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const access = await requireInternalUser(client, event, {
      methods: "GET,POST,PUT,OPTIONS",
    });
    if (access.errorResponse) return access.errorResponse;

    const { organizationId } = access;
    await ensureDeliveryTable(client);

    if (event.httpMethod === "GET") {
      const result = await client.query(
        `SELECT
           b.id,
           b."eventDate",
           b."startTime",
           b."endTime",
           b."venueAddress",
           b.status AS "bookingStatus",
           b."totalAmount",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           c.email AS "customerEmail",
           assignee."fullName" AS "assignedUserName",
           d.id AS "deliveryId",
           d.status AS "deliveryStatus",
           d."driverName",
           d."routeGroup",
           d."routeOrder",
           d.eta,
           d.notes,
           d."updatedAt" AS "deliveryUpdatedAt",
           COALESCE(
             json_agg(
               json_build_object(
                 'id', bi.id,
                 'productId', bi."productId",
                 'quantity', bi.quantity,
                 'productName', p.name,
                 'attendantsNeeded', p."attendantsNeeded",
                 'blowersNeeded', bc."motorsToPump"
               )
               ORDER BY bi.id
             ) FILTER (WHERE bi.id IS NOT NULL),
             '[]'::json
           ) AS items
         FROM "booking" b
         JOIN "customer" c ON c.id = b."customerId" AND c."organizationId" = b."organizationId"
         LEFT JOIN "user" assignee ON assignee.id = b."assignedUserId" AND assignee."organizationId" = b."organizationId"
         LEFT JOIN "delivery" d ON d."bookingId" = b.id
         LEFT JOIN "bookingItem" bi ON bi."bookingId" = b.id AND bi."organizationId" = b."organizationId"
         LEFT JOIN "product" p ON p.id = bi."productId" AND p."organizationId" = b."organizationId"
         LEFT JOIN "bouncy_castles" bc ON bc."productId" = bi."productId"
         WHERE b."organizationId" = $1
           AND COALESCE(b.status, '') NOT ILIKE 'cancelled'
         GROUP BY b.id, c.id, assignee.id, d.id
         ORDER BY b."eventDate" ASC,
           COALESCE(d."routeGroup", '') ASC,
           COALESCE(d."routeOrder", 9999) ASC,
           b.id ASC`,
        [organizationId]
      );
      return json(event, 200, result.rows || []);
    }

    if (event.httpMethod !== "POST" && event.httpMethod !== "PUT") {
      return json(event, 405, { error: "Method Not Allowed" });
    }

    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(event, 400, { error: "Invalid JSON body." });
    }

    const bookingId = Number(payload.bookingId);
    if (!Number.isFinite(bookingId)) {
      return json(event, 400, { error: "bookingId is required." });
    }

    const status = cleanText(payload.status) || "scheduled";
    let driverName = cleanText(payload.driverName) || null;
    const routeGroup = cleanText(payload.routeGroup) || null;
    const routeOrder = Number.isFinite(Number(payload.routeOrder)) ? Number(payload.routeOrder) : null;
    const eta = cleanText(payload.eta) || null;
    const notes = cleanText(payload.notes) || null;

    const bookingOwnershipRes = await client.query(
      `SELECT id, status
       FROM "booking"
       WHERE id = $1 AND "organizationId" = $2
       LIMIT 1`,
      [bookingId, organizationId]
    );
    if (bookingOwnershipRes.rowCount === 0) {
      return json(event, 404, { error: "Booking not found." });
    }
    const bookingStatus = String(bookingOwnershipRes.rows[0]?.status || "").trim().toLowerCase();
    if (bookingStatus === "completed") {
      return json(event, 409, { error: "Completed bookings are locked and can't be edited." });
    }

    if (!driverName) {
      const existingDriver = await client.query(
        `SELECT "driverName" FROM "delivery" WHERE "bookingId" = $1`,
        [bookingId]
      );
      driverName =
        existingDriver.rows[0]?.driverName
        || (await resolveAvailableDriver(client, bookingId, organizationId));
    }

    const upsert = await client.query(
      `INSERT INTO "delivery"
        ("bookingId", status, "driverName", "routeGroup", "routeOrder", eta, notes, "createdAt", "updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       ON CONFLICT ("bookingId")
       DO UPDATE SET
         status = EXCLUDED.status,
         "driverName" = EXCLUDED."driverName",
         "routeGroup" = EXCLUDED."routeGroup",
         "routeOrder" = EXCLUDED."routeOrder",
         eta = EXCLUDED.eta,
         notes = EXCLUDED.notes,
         "updatedAt" = NOW()
       RETURNING id, "bookingId", status, "driverName", "routeGroup", "routeOrder", eta, notes, "updatedAt"`,
      [bookingId, status, driverName, routeGroup, routeOrder, eta, notes]
    );

    return json(event, 200, upsert.rows[0]);
  } catch (err) {
    console.error("❌ Delivery error:", err);
    return json(event, 500, { error: "Failed to process delivery data" });
  } finally {
    await client.end().catch(() => {});
  }
}
