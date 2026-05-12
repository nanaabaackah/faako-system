import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const TOKEN_EXPIRY_SECONDS = 8 * 60 * 60;

// Dummy hash used during failed login lookups to prevent user-enumeration timing attacks.
// Format matches the real stored format: {32-hex-salt}:{128-hex-hash}
const DUMMY_HASH = `${"00".repeat(16)}:${"00".repeat(64)}`;

const getSecret = () => {
  const s = process.env.STROANE_AUTH_SECRET;
  if (!s) throw new Error("STROANE_AUTH_SECRET is not configured");
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
