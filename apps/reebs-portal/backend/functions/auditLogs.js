/* eslint-disable no-undef */
import { Client } from "pg";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { getRailwayWebhookDiagnostics, listAuditLogs } from "./_shared/auditLog.js";
import { requireAdmin, respond } from "./_shared/internalApi.js";

const METHODS = "GET,OPTIONS";

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return respond(event, 204, {}, { methods: METHODS });
  }

  if (event.httpMethod !== "GET") {
    return respond(event, 405, { error: "Method Not Allowed" }, { methods: METHODS });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const authResult = await requireAdmin(client, event, { methods: METHODS });
    if (authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const { organizationId } = authResult;
    const entries = await listAuditLogs(client, {
      organizationId,
      range: event.queryStringParameters?.range,
      source: event.queryStringParameters?.source,
      category: event.queryStringParameters?.category,
      severity: event.queryStringParameters?.severity,
      q: event.queryStringParameters?.q,
      take: event.queryStringParameters?.take,
    });
    const railwayEntries = entries.filter((entry) => entry.source === "railway");

    const summary = {
      total: entries.length,
      incidents: entries.filter((entry) => entry.source === "railway" || entry.category === "incident")
        .length,
      failures: entries.filter((entry) =>
        ["warning", "error"].includes(String(entry.severity || "").toLowerCase())
      ).length,
      actors: new Set(entries.map((entry) => entry.actorLabel).filter(Boolean)).size,
    };

    return respond(
      event,
      200,
      {
        entries,
        summary,
        filters: {
          range: String(event.queryStringParameters?.range || "7d"),
          source: String(event.queryStringParameters?.source || ""),
          category: String(event.queryStringParameters?.category || ""),
          severity: String(event.queryStringParameters?.severity || ""),
          q: String(event.queryStringParameters?.q || ""),
        },
        integrations: {
          railwayWebhook: getRailwayWebhookDiagnostics({
            currentWindowEvents: railwayEntries.length,
            latestEvent: railwayEntries[0] || null,
          }),
        },
      },
      { methods: METHODS }
    );
  } catch (error) {
    console.error("Audit log load failed", error);
    return respond(
      event,
      error?.statusCode || 500,
      { error: error?.message || "Unable to load audit logs." },
      { methods: METHODS }
    );
  } finally {
    await client.end().catch(() => {});
  }
}
