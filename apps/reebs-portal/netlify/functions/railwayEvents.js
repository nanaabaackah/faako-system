/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import {
  buildRailwayAuditEvent,
  ensureExtendedAuditLogSchema,
  writeAuditLog,
} from "./_shared/auditLog.js";
import { respond } from "./_shared/internalApi.js";

const METHODS = "POST,OPTIONS";

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: METHODS });
  }

  if (event.httpMethod !== "POST") {
    return respond(event, 405, { error: "Method Not Allowed" }, { methods: METHODS });
  }

  // Intentionally public: Railway posts deployment and alert events here.
  const configuredSecret = String(process.env.RAILWAY_WEBHOOK_SECRET || "").trim();
  if (!configuredSecret) {
    return respond(
      event,
      503,
      { error: "RAILWAY_WEBHOOK_SECRET is not configured." },
      { methods: METHODS }
    );
  }

  const suppliedSecret = String(
    event.queryStringParameters?.secret
      || event.headers?.["x-faako-webhook-secret"]
      || event.headers?.["X-Faako-Webhook-Secret"]
      || event.headers?.["x-railway-webhook-secret"]
      || event.headers?.["X-Railway-Webhook-Secret"]
      || ""
  ).trim();

  if (!suppliedSecret || suppliedSecret !== configuredSecret) {
    return respond(event, 401, { error: "Invalid webhook secret." }, { methods: METHODS });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return respond(event, 400, { error: "Invalid JSON body." }, { methods: METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureExtendedAuditLogSchema(client);
    await writeAuditLog(client, buildRailwayAuditEvent(payload));
    return respond(event, 202, { ok: true }, { methods: METHODS });
  } catch (error) {
    console.error("Railway event ingest failed", error);
    return respond(
      event,
      error?.statusCode || 500,
      { error: error?.message || "Unable to record Railway event." },
      { methods: METHODS }
    );
  } finally {
    await client.end().catch(() => {});
  }
}
