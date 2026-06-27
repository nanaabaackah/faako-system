/* eslint-disable no-undef */
import "../../runtimeEnv.js";
import { verifyPassword } from "../../utils/passwords.js";
import { signManagerToken } from "./_shared/managerAuth.js";
import { resolvePgSslConfig } from "../../runtimeEnv.js";
import { Client } from "pg";
import {
  applyWindowRateLimit,
  getRequestClientIp,
} from "./_shared/requestRateLimit.js";

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

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const pin = typeof payload.pin === "string" ? payload.pin.trim() : "";
  if (!pin || !/^\d{6}$/.test(pin)) {
    return json(400, { error: "Enter a valid 6-digit PIN." });
  }

  const storedHash = process.env.MANAGER_PIN_HASH;
  if (!storedHash) {
    return json(500, { error: "Manager PIN is not configured." });
  }

  const { isValid } = await verifyPassword(pin, storedHash);
  if (!isValid) {
    return json(401, { error: "Invalid PIN." });
  }

  const organizationId = Number(process.env.MANAGER_ORGANIZATION_ID);
  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return json(500, { error: "Manager organization is not configured." });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: resolvePgSslConfig(),
  });

  try {
    await client.connect();
    const limitResult = await applyWindowRateLimit(client, {
      scope: `manager-login:${organizationId}:ip`,
      identifier: getRequestClientIp(event),
      limit: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limitResult.allowed) {
      return json(
        429,
        { error: "Too many attempts. Try again later." },
        { "Retry-After": String(limitResult.retryAfterSeconds) }
      );
    }

    const token = signManagerToken({
      role: "manager",
      organizationId,
      scopes: [
        "manager:orders:read",
        "manager:bookings:read",
        "manager:device:write",
      ],
    });
    if (!token) {
      return json(500, { error: "Manager secret is not configured." });
    }

    return json(200, {
      token,
      expiresInHours: 24 * 7,
    });
  } catch (error) {
    console.error("Manager login error", error);
    return json(500, { error: "Manager login failed." });
  } finally {
    await client.end().catch(() => {});
  }
}
