import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60;
export const ADMIN_AUTH_COOKIE_NAME =
  String(process.env.STROANE_ADMIN_AUTH_COOKIE_NAME || "stroane_admin_session").trim()
  || "stroane_admin_session";

// Dummy hash used during failed login lookups to prevent user-enumeration timing attacks.
// Format matches the real stored format: {32-hex-salt}:{128-hex-hash}
const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(64)}`;

const getSecret = () => {
  const s = process.env.APP_AUTH_SECRET || process.env.STROANE_AUTH_SECRET;
  if (!s) throw new Error("APP_AUTH_SECRET is not configured");
  return s;
};

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString("hex");
  return `${salt}:${hash}`;
};

export const verifyPassword = (password, stored) => {
  const colonIdx = stored.indexOf(":");
  if (colonIdx < 1) return false;
  const salt = stored.slice(0, colonIdx);
  const hash = stored.slice(colonIdx + 1);
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  if (candidate.length !== hashBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, candidate);
};

// Always runs a hash comparison even when no user found, to prevent timing-based
// user enumeration.
export const safeVerifyPassword = (password, storedOrNull) => {
  return verifyPassword(password, storedOrNull ?? DUMMY_HASH);
};

export const signToken = (payload) => {
  const data = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
};

const isProductionRuntime = () =>
  process.env.NODE_ENV === "production" || process.env.APP_ENV === "production";

const normalizeSameSite = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "strict" || normalized === "none") return normalized;
  return "lax";
};

const shouldUseSecureCookie = () => {
  const configured = String(process.env.STROANE_ADMIN_AUTH_COOKIE_SECURE || "").trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  return isProductionRuntime();
};

const getAuthCookieOptions = () => {
  const options = {
    httpOnly: true,
    secure: shouldUseSecureCookie(),
    sameSite: normalizeSameSite(process.env.STROANE_ADMIN_AUTH_COOKIE_SAME_SITE),
    maxAge: TOKEN_EXPIRY_SECONDS * 1000,
    path: "/",
  };

  const domain = String(process.env.STROANE_ADMIN_AUTH_COOKIE_DOMAIN || "").trim();
  if (domain) {
    options.domain = domain;
  }

  return options;
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
      try {
        cookies.set(key, decodeURIComponent(rawValue));
      } catch {
        cookies.set(key, rawValue);
      }
    });
  return cookies;
};

export const getAdminAuthCookieToken = (req) => {
  const cookies = parseCookieHeader(req?.headers?.cookie || req?.headers?.Cookie || "");
  return cookies.get(ADMIN_AUTH_COOKIE_NAME) || "";
};

export const getRequestAuthToken = (req) => {
  const authHeader = String(req?.headers?.authorization || "");
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  return bearerToken || getAdminAuthCookieToken(req);
};

export const setAdminAuthCookie = (res, token) => {
  if (!token || typeof res?.cookie !== "function") return;
  res.cookie(ADMIN_AUTH_COOKIE_NAME, token, getAuthCookieOptions());
};

export const clearAdminAuthCookie = (res) => {
  if (typeof res?.clearCookie !== "function") return;
  const options = getAuthCookieOptions();
  delete options.maxAge;
  res.clearCookie(ADMIN_AUTH_COOKIE_NAME, options);
};

export const verifyToken = (token) => {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expectedSig;
  try {
    expectedSig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
  } catch {
    return null;
  }

  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expectedSig, "base64url");
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};
