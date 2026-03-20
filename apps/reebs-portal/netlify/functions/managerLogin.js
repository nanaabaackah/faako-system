/* eslint-disable no-undef */
import "../../runtimeEnv.js";
import { verifyPassword } from "../../utils/passwords.js";
import { signManagerToken } from "./_shared/managerAuth.js";

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
