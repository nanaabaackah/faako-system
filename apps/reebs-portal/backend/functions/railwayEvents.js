/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import {
  buildRailwayAuditEvent,
  ensureExtendedAuditLogSchema,
  extractRailwayWebhookSecret,
  getRailwayWebhookSecret,
  timingSafeSecretEqual,
  writeAuditLog,
} from "./_shared/auditLog.js";
import { respond } from "./_shared/internalApi.js";

const METHODS = "POST,OPTIONS";
const RESPONSE_OPTIONS = {
  methods: METHODS,
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-Faako-Webhook-Secret",
    "X-Railway-Webhook-Secret",
    "X-Webhook-Secret",
  ].join(", "),
};

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, RESPONSE_OPTIONS);
  }

  if (event.httpMethod !== "POST") {
    return respond(event, 405, { error: "Method Not Allowed" }, RESPONSE_OPTIONS);
  }

  if (Buffer.byteLength(String(event.body || ""), "utf8") > 256 * 1024) {
    return respond(event, 413, { error: "Webhook payload is too large." }, RESPONSE_OPTIONS);
  }

  // Intentionally public: Railway posts deployment and alert events here.
  const configuredSecret = getRailwayWebhookSecret();
  if (!configuredSecret) {
    return respond(
      event,
      503,
      { error: "RAILWAY_WEBHOOK_SECRET is not configured." },
      RESPONSE_OPTIONS
    );
  }

  const suppliedSecret = extractRailwayWebhookSecret(event);

  if (!timingSafeSecretEqual(suppliedSecret, configuredSecret)) {
    return respond(event, 401, { error: "Invalid webhook secret." }, RESPONSE_OPTIONS);
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return respond(event, 400, { error: "Invalid JSON body." }, RESPONSE_OPTIONS);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureExtendedAuditLogSchema(client);
    await writeAuditLog(client, buildRailwayAuditEvent(payload));
    return respond(event, 202, { ok: true }, RESPONSE_OPTIONS);
  } catch (error) {
    console.error("Railway event ingest failed", { code: error?.code, requestId: event?.requestId });
    return respond(
      event,
      error?.statusCode || 500,
      { error: "Unable to record Railway event." },
      RESPONSE_OPTIONS
    );
  } finally {
    await client.end().catch(() => {});
  }
}
