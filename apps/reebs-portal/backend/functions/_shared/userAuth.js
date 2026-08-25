import crypto from "crypto";
import { touchUserSession } from "./userSessions.js";
import { isTrustedBrowserMutation } from "./http.js";

const getSecret = () => process.env.USER_APP_SECRET || "";
export const USER_SESSION_COOKIE_NAME =
  String(process.env.USER_SESSION_COOKIE_NAME || "reebs_user_session").trim()
  || "reebs_user_session";

const base64UrlEncode = (value) => Buffer.from(value, "utf8").toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");

const getHeaderValue = (event, key) => {
  const headers = event?.headers;
  if (!headers || typeof headers !== "object") return "";
  return String(
    headers[key]
    || headers[key.toLowerCase()]
    || headers[key.toUpperCase()]
    || ""
  ).trim();
};

const parseCookieHeader = (value) => {
  const cookies = new Map();
  String(value || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return;
      const key = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();
      if (!key) return;
      cookies.set(key, rawValue);
    });
  return cookies;
};

const isLocalHostValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized.includes("localhost") || normalized.includes("127.0.0.1");
};

const shouldUseSecureCookies = (event) => {
  const forwardedProto = getHeaderValue(event, "x-forwarded-proto").toLowerCase();
  if (forwardedProto === "http") return false;
  if (forwardedProto === "https") return true;

  const origin = getHeaderValue(event, "origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === "https:";
    } catch {
      return !isLocalHostValue(origin);
    }
  }

  const host = getHeaderValue(event, "host");
  return host ? !isLocalHostValue(host) : true;
};

const resolveCookieDomain = () => {
  const configuredDomain = String(process.env.USER_SESSION_COOKIE_DOMAIN || "").trim();
  if (configuredDomain && !isLocalHostValue(configuredDomain)) {
    return configuredDomain;
  }
  return "";
};

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
  const safeEqual =
    signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!safeEqual) return null;

  let payload = null;
  try {
    payload = JSON.parse(json);
  } catch {
    return null;
  }
  if (!payload?.exp || Date.now() > payload.exp) return null;
  return payload;
};

export const signUserToken = (payload, ttlMs = 1000 * 60 * 60 * 24 * 7) => {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Date.now() + ttlMs;
  return signPayload({ ...payload, exp }, secret);
};

export const verifyUserToken = (token) => {
  const secret = getSecret();
  return verifyPayload(token, secret);
};

export const getBearerUserTokenFromEvent = (event) => {
  // Temporary legacy compatibility for supported non-browser clients. New web
  // sessions authenticate only through the HttpOnly session cookie.
  const header = event?.headers?.authorization || event?.headers?.Authorization || "";
  if (!header || !header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
};

export const getCookieUserTokenFromEvent = (event) => {
  const cookies = parseCookieHeader(
    getHeaderValue(event, "cookie") || getHeaderValue(event, "Cookie")
  );
  const token = cookies.get(USER_SESSION_COOKIE_NAME);
  if (!token) return null;
  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
};

export const getUserTokenFromEvent = (event) =>
  getCookieUserTokenFromEvent(event) || getBearerUserTokenFromEvent(event);

export const getUserFromEvent = (event) => {
  const token = getUserTokenFromEvent(event);
  return verifyUserToken(token);
};

export const buildUserSessionCookie = (event, token, { ttlMs } = {}) => {
  const parts = [
    `${USER_SESSION_COOKIE_NAME}=${encodeURIComponent(String(token || ""))}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (shouldUseSecureCookies(event)) {
    parts.push("Secure");
  }

  const domain = resolveCookieDomain(event);
  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  const ttlSeconds = Math.max(0, Math.floor(Number(ttlMs || 0) / 1000));
  if (ttlSeconds > 0) {
    parts.push(`Max-Age=${ttlSeconds}`);
  }

  return parts.join("; ");
};

export const clearUserSessionCookie = (event) => {
  const parts = [
    `${USER_SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "Max-Age=0",
  ];

  if (shouldUseSecureCookies(event)) {
    parts.push("Secure");
  }

  const domain = resolveCookieDomain(event);
  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  return parts.join("; ");
};

export const requireUser = async (client, event) => {
  const cookieToken = getCookieUserTokenFromEvent(event);
  // Cookie authentication is deliberately selected before Bearer authentication.
  // A second Authorization header must not turn an untrusted cookie mutation into
  // a Bearer request and bypass the browser-origin check.
  if (cookieToken && !isTrustedBrowserMutation(event)) {
    return null;
  }

  const payload = getUserFromEvent(event);
  const userId = Number(payload?.userId);
  const organizationId = Number(payload?.organizationId);
  const sessionTokenId = typeof payload?.sessionTokenId === "string" ? payload.sessionTokenId.trim() : "";
  if (!Number.isFinite(userId) || !Number.isFinite(organizationId)) return null;

  if (sessionTokenId) {
    try {
      const sessionResult = await client.query(
        `SELECT
           u.id,
           u."organizationId",
           u.role,
           u.permissions,
           u."fullName",
           u.email,
           s."sessionTokenId",
           s."createdAt" AS "sessionCreatedAt",
           s."lastSeenAt" AS "sessionLastSeenAt"
         FROM "user" u
         INNER JOIN "userSession" s
           ON s."userId" = u.id
          AND s."organizationId" = u."organizationId"
         WHERE u.id = $1
           AND u."organizationId" = $2
           AND s."sessionTokenId" = $3
           AND s."revokedAt" IS NULL
           AND s."expiresAt" > NOW()
         LIMIT 1`,
        [userId, organizationId, sessionTokenId]
      );

      if (sessionResult.rowCount > 0) {
        await touchUserSession(client, sessionTokenId).catch(() => {});
        return sessionResult.rows[0];
      }
      return null;
    } catch (error) {
      if (error?.code !== "42P01") {
        throw error;
      }
      return null;
    }
  }

  // Historical user tokens without a database session cannot be revoked after
  // logout, password reset, or an access change. Fail closed instead of falling
  // back to a user-row-only lookup. Session-bound bearer tokens remain supported.
  return null;
};
