/* eslint-disable no-undef */
import crypto from "crypto";

const getSecret = () => process.env.MANAGER_APP_SECRET || "";
export const MANAGER_TOKEN_VERSION = 1;
export const DEFAULT_MANAGER_SCOPES = [
  "manager:orders:read",
  "manager:bookings:read",
  "manager:device:write",
];

const base64UrlEncode = (value) => Buffer.from(value, "utf8").toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");

const signPayload = (payload, secret) => {
  const json = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", secret).update(json).digest("base64url");
  return `${base64UrlEncode(json)}.${signature}`;
};

const verifyPayload = (token, secret) => {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  let json = "";
  try {
    json = base64UrlDecode(payloadB64);
  } catch {
    return null;
  }
  const expected = crypto.createHmac("sha256", secret).update(json).digest("base64url");
  const safeEqual = signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!safeEqual) return null;

  let payload = null;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!payload?.exp || Date.now() > payload.exp) return null;
  if (payload?.version !== MANAGER_TOKEN_VERSION) return null;
  if (payload?.aud !== "reebs-manager-mobile") return null;
  if (!Number.isInteger(Number(payload?.organizationId)) || Number(payload.organizationId) <= 0) {
    return null;
  }
  return payload;
};

export const normalizeManagerScopes = (scopes) => {
  const normalized = Array.isArray(scopes)
    ? scopes.map((scope) => String(scope || "").trim()).filter(Boolean)
    : [];
  const unique = [...new Set(normalized)];
  return unique.length ? unique : [...DEFAULT_MANAGER_SCOPES];
};

export const hasManagerScope = (manager, requiredScope) => {
  if (!requiredScope) return true;
  const scopes = normalizeManagerScopes(manager?.scopes);
  if (scopes.includes("*")) return true;
  if (scopes.includes(requiredScope)) return true;
  const [namespace] = String(requiredScope).split(":");
  return scopes.includes(`${namespace}:*`);
};

export const signManagerToken = (payload, ttlMs = 1000 * 60 * 60 * 24 * 7) => {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + ttlMs;
  return signPayload(
    {
      ...payload,
      aud: "reebs-manager-mobile",
      version: MANAGER_TOKEN_VERSION,
      scopes: normalizeManagerScopes(payload?.scopes),
      exp,
    },
    secret
  );
};

export const verifyManagerToken = (token) => {
  const secret = getSecret();
  const payload = verifyPayload(token, secret);
  if (!payload) return null;
  return {
    ...payload,
    scopes: normalizeManagerScopes(payload.scopes),
  };
};

export const getManagerFromEvent = (event, { requiredScopes = [] } = {}) => {
  const header = event?.headers?.authorization || event?.headers?.Authorization || "";
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  const payload = verifyManagerToken(token);
  if (!payload) return null;
  if (requiredScopes.some((scope) => !hasManagerScope(payload, scope))) {
    return null;
  }
  return payload;
};
