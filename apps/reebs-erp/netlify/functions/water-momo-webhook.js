/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

const saleTableStatements = [
  `CREATE TABLE IF NOT EXISTS "waterSale" (
    "id" SERIAL PRIMARY KEY,
    "organizationId" INTEGER NOT NULL,
    "productKey" TEXT NOT NULL DEFAULT 'gwater-12pk',
    "productName" TEXT NOT NULL DEFAULT '12pk Gwater',
    "quantity" INTEGER NOT NULL,
    "saleChannel" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "paymentReference" TEXT,
    "providerReference" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "customerId" INTEGER,
    "customerName" TEXT,
    "notes" TEXT,
    "date" TIMESTAMPTZ NOT NULL,
    "paidAt" TIMESTAMPTZ,
    "createdByUserId" INTEGER,
    "createdByName" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'cash'`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'paid'`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "providerReference" TEXT`,
  `ALTER TABLE "waterSale" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ`,
];

const ensureSaleTable = async (client) => {
  for (const statement of saleTableStatements) {
    await client.query(statement);
  }

  await client.query(
    `UPDATE "waterSale"
     SET "paymentReference" = 'WATER-' || "organizationId"::text || '-' || id::text
     WHERE COALESCE(NULLIF(TRIM("paymentReference"), ''), '') = ''`
  );
};

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const parseDate = (value) => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseMoney = (value) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value * 100);
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
};

const parseWebhookAmount = (payload = {}) => {
  const minorValue = Number(payload.amountCents ?? payload.amountMinor ?? payload.amountPesewas);
  if (Number.isFinite(minorValue) && minorValue > 0) {
    return Math.round(minorValue);
  }
  return parseMoney(payload.amount);
};

const normalizePaymentMethod = (value) => {
  const normalized = cleanText(value).toLowerCase();
  if (normalized === "cash") return "cash";
  if (normalized === "credit" || normalized === "pay later" || normalized === "paylater") {
    return "credit";
  }
  return "momo";
};

const normalizeMtnReasonStatus = (value) => {
  const normalized = cleanText(value).toLowerCase();
  if (!normalized) return "";

  if (
    normalized.includes("ongoing") ||
    normalized.includes("delayed") ||
    normalized.includes("pending") ||
    normalized.includes("processing")
  ) {
    return "pending";
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("rejected") ||
    normalized.includes("expired") ||
    normalized.includes("notallowed") ||
    normalized.includes("notfound") ||
    normalized.includes("serviceunavailable") ||
    normalized.includes("internalprocessingerror") ||
    normalized.includes("couldnotperformtransaction") ||
    normalized.includes("invalid")
  ) {
    return "unpaid";
  }

  return "";
};

const normalizePaymentStatus = (
  value,
  paymentMethod = "momo",
  successValue = null,
  reasonCode = ""
) => {
  if (typeof successValue === "boolean") {
    return successValue ? "paid" : "unpaid";
  }

  const normalized = cleanText(value).toLowerCase();
  if (
    normalized === "paid" ||
    normalized === "success" ||
    normalized === "successful" ||
    normalized === "completed" ||
    normalized === "confirmed"
  ) {
    return "paid";
  }
  if (normalized === "pending" || normalized === "processing" || normalized === "awaiting") {
    return "pending";
  }
  if (
    normalized === "unpaid" ||
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "reversed"
  ) {
    return "unpaid";
  }

  const reasonStatus = normalizeMtnReasonStatus(reasonCode);
  if (reasonStatus) {
    return reasonStatus;
  }

  const method = normalizePaymentMethod(paymentMethod);
  if (method === "cash") return "paid";
  if (method === "credit") return "unpaid";
  return "pending";
};

const parseWaterReference = (value) => {
  const raw = cleanText(value);
  const match = /^WATER-(\d+)-(\d+)$/i.exec(raw);
  if (!match) return null;
  return {
    organizationId: Number(match[1]),
    saleId: Number(match[2]),
    paymentReference: `WATER-${match[1]}-${match[2]}`,
  };
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, X-Water-Webhook-Secret",
        "Access-Control-Allow-Methods": "POST,PUT,OPTIONS",
      },
      body: "",
    };
  }

  const method = (event.httpMethod || "POST").toUpperCase();
  if (method !== "POST" && method !== "PUT") {
    return json(405, { error: "Method Not Allowed" });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  if (payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    payload = {
      ...payload.data,
      ...payload,
    };
  }

  const configuredSecret = cleanText(process.env.WATER_MOMO_WEBHOOK_SECRET);
  const providedSecret =
    cleanText(event.headers?.["x-water-webhook-secret"]) ||
    cleanText(event.headers?.["X-Water-Webhook-Secret"]) ||
    cleanText(event.queryStringParameters?.secret) ||
    cleanText(payload.secret);

  if (!configuredSecret) {
    return json(503, { error: "WATER_MOMO_WEBHOOK_SECRET is not configured." });
  }

  if (configuredSecret && providedSecret !== configuredSecret) {
    return json(401, { error: "Invalid webhook secret." });
  }

  const explicitSaleId = Number(payload.saleId ?? event.queryStringParameters?.saleId);
  const incomingReference =
    cleanText(payload.paymentReference) ||
    cleanText(payload.reference) ||
    cleanText(payload.clientReference) ||
    cleanText(payload.merchantReference) ||
    cleanText(payload.externalId) ||
    cleanText(payload.externalReferenceId) ||
    cleanText(event.queryStringParameters?.paymentReference) ||
    cleanText(event.queryStringParameters?.reference);
  const parsedReference = parseWaterReference(incomingReference);
  const saleId =
    Number.isFinite(explicitSaleId) && explicitSaleId > 0
      ? explicitSaleId
      : Number.isFinite(parsedReference?.saleId)
        ? parsedReference.saleId
        : null;
  const organizationId =
    Number.isFinite(Number(payload.organizationId)) && Number(payload.organizationId) > 0
      ? Number(payload.organizationId)
      : Number.isFinite(parsedReference?.organizationId)
        ? parsedReference.organizationId
        : null;

  if (!saleId && !incomingReference) {
    return json(400, { error: "A sale id or payment reference is required." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureSaleTable(client);

    let saleRes;
    if (saleId) {
      const values = [saleId];
      const organizationFilter =
        Number.isFinite(organizationId) && organizationId > 0
          ? ` AND "organizationId" = $2`
          : "";
      if (organizationFilter) values.push(organizationId);
      saleRes = await client.query(
        `SELECT
           id,
           "organizationId",
           "paymentMethod",
           "paymentStatus",
           "paymentReference",
           "providerReference",
           "totalAmount",
           "paidAt"
         FROM "waterSale"
         WHERE id = $1${organizationFilter}
         LIMIT 1`,
        values
      );
    } else {
      saleRes = await client.query(
        `SELECT
           id,
           "organizationId",
           "paymentMethod",
           "paymentStatus",
           "paymentReference",
           "providerReference",
           "totalAmount",
           "paidAt"
         FROM "waterSale"
         WHERE "paymentReference" = $1
         LIMIT 1`,
        [incomingReference]
      );
    }

    if (!saleRes || saleRes.rowCount === 0) {
      return json(404, { error: "Water sale not found for this notification." });
    }

    const sale = saleRes.rows[0];
    const expectedAmount = Number(sale.totalAmount || 0);
    const notifiedAmount = parseWebhookAmount(payload);
    if (notifiedAmount && expectedAmount > 0 && notifiedAmount !== expectedAmount) {
      return json(409, {
        error: "Payment amount does not match the recorded sale total.",
        expectedAmount,
        notifiedAmount,
      });
    }

    const reasonCode = cleanText(payload.reason?.code) || cleanText(payload.reasonCode);
    const nextPaymentMethod = normalizePaymentMethod(payload.paymentMethod || "momo");
    const nextPaymentStatus = normalizePaymentStatus(
      payload.paymentStatus || payload.status || "paid",
      nextPaymentMethod,
      typeof payload.success === "boolean" ? payload.success : null,
      reasonCode
    );
    const nextProviderReference =
      cleanText(payload.providerReference) ||
      cleanText(payload.financialTransactionId) ||
      cleanText(payload.referenceId) ||
      cleanText(payload.transactionId) ||
      cleanText(payload.externalReference) ||
      cleanText(payload.notificationId) ||
      cleanText(event.headers?.["x-reference-id"]) ||
      cleanText(event.headers?.["X-Reference-Id"]) ||
      cleanText(sale.providerReference) ||
      null;
    const nextPaymentReference =
      cleanText(sale.paymentReference) ||
      parsedReference?.paymentReference ||
      incomingReference ||
      `WATER-${sale.organizationId}-${sale.id}`;
    const nextPaidAt =
      nextPaymentStatus === "paid"
        ? parseDate(payload.paidAt || payload.date || sale.paidAt || new Date().toISOString())
        : sale.paidAt || null;

    const updateRes = await client.query(
      `UPDATE "waterSale"
       SET "paymentMethod" = $2,
           "paymentStatus" = $3,
           "paymentReference" = $4,
           "providerReference" = $5,
           "paidAt" = $6
       WHERE id = $1
       RETURNING
         id,
         "organizationId",
         "paymentMethod",
         "paymentStatus",
         "paymentReference",
         "providerReference",
         "paidAt"`,
      [
        sale.id,
        nextPaymentMethod,
        nextPaymentStatus,
        nextPaymentReference,
        nextProviderReference,
        nextPaidAt,
      ]
    );

    return json(200, {
      ok: true,
      sale: updateRes.rows?.[0] || null,
    });
  } catch (err) {
    console.error("Water MoMo webhook error", err);
    return json(500, { error: "Failed to process the MoMo notification." });
  } finally {
    await client.end().catch(() => {});
  }
}
