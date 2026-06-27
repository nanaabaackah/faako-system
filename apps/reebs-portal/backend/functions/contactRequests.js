/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { ensureCrmContactTables } from "./_shared/crmContact.js";
import { requireInternalUser, respond } from "./_shared/internalApi.js";

const CONTACT_REQUEST_METHODS = "GET,PATCH,OPTIONS";
const CONTACT_REQUEST_STATUSES = new Set([
  "new",
  "reviewing",
  "waiting_customer",
  "quoted",
  "converted",
  "closed",
  "spam",
]);

const cleanText = (value, maxLength = 240) =>
  String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const normalizeStatus = (value) => {
  const normalized = cleanText(value, 80).toLowerCase().replace(/[\s-]+/g, "_");
  return CONTACT_REQUEST_STATUSES.has(normalized) ? normalized : "";
};

const parseJsonBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};

const toInt = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
};

const toContactRequest = (row) => ({
  id: row.id,
  customerId: row.customerId,
  customerName: row.customerName || row.name,
  customerEmail: row.customerEmail || row.email,
  customerPhone: row.customerPhone || row.phone,
  source: row.source,
  status: row.status,
  priority: row.priority,
  topic: row.topic,
  eventDate: row.eventDate,
  location: row.location,
  message: row.message,
  followUpDueAt: row.followUpDueAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: CONTACT_REQUEST_METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();

    const body = event.httpMethod === "PATCH" ? parseJsonBody(event) : null;
    if (event.httpMethod === "PATCH" && !body) {
      return respond(event, 400, { error: "Invalid JSON body." }, { methods: CONTACT_REQUEST_METHODS });
    }

    const authResult = await requireInternalUser(client, event, {
      methods: CONTACT_REQUEST_METHODS,
      permission: event.httpMethod === "GET" ? "customers:read" : "customers:write",
      permissionError: "Customer access is required for contact requests.",
      body,
    });
    if (authResult.errorResponse) return authResult.errorResponse;
    const { authUser, organizationId } = authResult;

    await ensureCrmContactTables(client);

    if (event.httpMethod === "GET") {
      const status = normalizeStatus(event.queryStringParameters?.status || "");
      const customerId = toInt(event.queryStringParameters?.customerId);
      const openOnly = String(event.queryStringParameters?.open || "").trim() === "1";

      const where = [`r."organizationId" = $1`];
      const values = [organizationId];
      let index = 2;

      if (status) {
        where.push(`r.status = $${index++}`);
        values.push(status);
      } else if (openOnly) {
        where.push(`r.status NOT IN ('closed', 'converted', 'spam')`);
      }

      if (customerId) {
        where.push(`r."customerId" = $${index++}`);
        values.push(customerId);
      }

      const result = await client.query(
        `SELECT
           r.id,
           r."customerId" AS "customerId",
           r.source,
           r.status,
           r.priority,
           r.name,
           r.email,
           r.phone,
           r.topic,
           r."eventDate" AS "eventDate",
           r.location,
           r.message,
           r."followUpDueAt" AS "followUpDueAt",
           r."createdAt" AS "createdAt",
           r."updatedAt" AS "updatedAt",
           c.name AS "customerName",
           c.email AS "customerEmail",
           c.phone AS "customerPhone"
         FROM "contactRequest" r
         LEFT JOIN "customer" c ON c.id = r."customerId" AND c."organizationId" = r."organizationId"
         WHERE ${where.join(" AND ")}
         ORDER BY r."createdAt" DESC
         LIMIT 100`,
        values
      );

      return respond(event, 200, {
        requests: result.rows.map(toContactRequest),
      }, { methods: CONTACT_REQUEST_METHODS });
    }

    if (event.httpMethod !== "PATCH") {
      return respond(event, 405, { error: "Method Not Allowed" }, { methods: CONTACT_REQUEST_METHODS });
    }

    const id = toInt(body.id);
    const status = normalizeStatus(body.status);
    const note = cleanText(body.note, 500);
    if (!id || !status) {
      return respond(event, 400, {
        error: "Contact request id and valid status are required.",
      }, { methods: CONTACT_REQUEST_METHODS });
    }

    await client.query("BEGIN");
    try {
      const updatedRes = await client.query(
        `UPDATE "contactRequest"
         SET status = $1,
             "updatedAt" = NOW()
         WHERE id = $2
           AND "organizationId" = $3
         RETURNING id, "customerId", source, status, priority, name, email, phone, topic,
                   "eventDate", location, message, "followUpDueAt", "createdAt", "updatedAt"`,
        [status, id, organizationId]
      );

      if (updatedRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return respond(event, 404, { error: "Contact request not found." }, { methods: CONTACT_REQUEST_METHODS });
      }

      const updated = updatedRes.rows[0];
      await client.query(
        `INSERT INTO "customerActivity" (
          "organizationId",
          "customerId",
          "contactRequestId",
          type,
          title,
          description,
          status,
          metadata,
          "createdAt",
          "updatedAt"
        ) VALUES ($1, $2, $3, 'contact_request_status', $4, $5, 'done', $6::jsonb, NOW(), NOW())`,
        [
          organizationId,
          updated.customerId,
          updated.id,
          `Contact request marked ${status.replace(/_/g, " ")}`,
          note || `Status changed to ${status.replace(/_/g, " ")}.`,
          JSON.stringify({
            status,
            actorUserId: authUser?.id || null,
          }),
        ]
      );

      await client.query("COMMIT");
      return respond(event, 200, {
        request: toContactRequest(updated),
      }, { methods: CONTACT_REQUEST_METHODS });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("Contact requests error", {
      message: error?.message || String(error),
    });
    return respond(event, Number(error?.statusCode) || 500, {
      error: error?.message || "Unable to process contact requests.",
    }, { methods: CONTACT_REQUEST_METHODS });
  } finally {
    await client.end().catch(() => {});
  }
}
