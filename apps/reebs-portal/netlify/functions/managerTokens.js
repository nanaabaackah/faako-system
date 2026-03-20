/* eslint-disable no-undef */
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import { getManagerFromEvent } from "./_shared/managerAuth.js";
import { ensureManagerDeviceTable } from "./_shared/managerPush.js";

const json = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

export async function handler(event = {}) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      },
      body: "",
    };
  }
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method Not Allowed" }, { "Access-Control-Allow-Methods": "POST,OPTIONS" });
  }

  const manager = getManagerFromEvent(event);
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
      `INSERT INTO "managerDevice" ("token", "platform", "deviceId", "lastSeenAt", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW(), NOW())
       ON CONFLICT ("token")
       DO UPDATE SET
         "platform" = EXCLUDED."platform",
         "deviceId" = EXCLUDED."deviceId",
         "lastSeenAt" = NOW(),
         "updatedAt" = NOW()
       RETURNING id`,
      [token, platform, deviceId]
    );
    return json(200, { id: result.rows[0]?.id });
  } catch (err) {
    console.error("Manager token error", err);
    return json(500, { error: "Failed to save device token." });
  } finally {
    await client.end().catch(() => {});
  }
}
