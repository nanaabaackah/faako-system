/* eslint-disable no-undef */
import "../../runtimeEnv.js";
import { verifyPassword } from "../../utils/passwords.js";
import { signManagerToken } from "./_shared/managerAuth.js";

const MANAGER_RATE_LIMIT_MAX = 10;
const MANAGER_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const ipAttempts = new Map();

const checkIpRateLimit = (ip) => {
  const now = Date.now();
  const bucket = ipAttempts.get(ip) || { count: 0, windowStart: now };
  if (now - bucket.windowStart > MANAGER_RATE_LIMIT_WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  ipAttempts.set(ip, bucket);
  return bucket.count > MANAGER_RATE_LIMIT_MAX;
};

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

  const clientIp = event.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";
  if (checkIpRateLimit(clientIp)) {
    return json(429, { error: "Too many attempts. Try again later." }, { "Retry-After": "600" });
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

  const token = signManagerToken({ role: "manager" });
  if (!token) {
    return json(500, { error: "Manager secret is not configured." });
  }

  return json(200, {
    token,
    expiresInHours: 24 * 7,
  });
}
