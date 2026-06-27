/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getManagerFromEvent } from "./_shared/managerAuth.js";
import { ensureManagerDeviceTable } from "./_shared/managerPush.js";

const MANAGER_ORIGIN = String(process.env.MANAGER_APP_ORIGIN || process.env.URL || "").trim();
const allowedOrigin = MANAGER_ORIGIN || null;

const corsHeaders = (extraAllow = "POST,OPTIONS") => ({
  ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Organization-Id, X-CSRF-Token",
  "Access-Control-Allow-Methods": extraAllow,
  "Vary": "Origin",
});

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    ...corsHeaders(),
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" }, { "Access-Control-Allow-Methods": "POST,OPTIONS" });
  }

  const manager = getManagerFromEvent(event, {
    requiredScopes: ["manager:device:write"],
  });
  if (!manager) {
    return json(401, { error: "Unauthorized" });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) {
    return json(400, { error: "Token is required." });
  }
  const platform = typeof payload.platform === "string" ? payload.platform.trim() : null;
  const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.trim() : null;

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    await ensureManagerDeviceTable(client);
    const result = await client.query(
      `INSERT INTO "managerDevice" ("organizationId", "token", "platform", "deviceId", "lastSeenAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
       ON CONFLICT ("token")
       DO UPDATE SET
         "organizationId" = EXCLUDED."organizationId",
         "platform" = EXCLUDED."platform",
         "deviceId" = EXCLUDED."deviceId",
         "lastSeenAt" = NOW(),
         "updatedAt" = NOW()
       RETURNING id`,
      [Number(manager.organizationId), token, platform, deviceId]
    );
    return json(200, { id: result.rows[0]?.id });
  } catch (err) {
    console.error("Manager token error", err);
    return json(500, { error: "Failed to save device token." });
  } finally {
    await client.end().catch(() => {});
  }
}
