import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
export const CONTINUATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const tokenPattern = new RegExp(`^v1\\.(${uuidPattern})\\.(\\d{10})\\.([A-Za-z0-9_-]{43})$`, "i");

function decodeSecret(value) {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(value || "")) throw new Error("TWE_ENQUIRY_CONTINUATION_SECRET must be a base64url secret of at least 32 bytes.");
  const secret = Buffer.from(value, "base64url");
  if (secret.length < 32) throw new Error("TWE_ENQUIRY_CONTINUATION_SECRET must contain at least 32 bytes.");
  return secret;
}

function readOrigin(value, environment) {
  const fallback = ["development", "test"].includes(environment) ? "http://localhost:4328" : "";
  const raw = value || fallback;
  let url;
  try { url = new URL(raw); } catch { throw new Error("TWE_PUBLIC_SITE_ORIGIN must be an exact origin."); }
  const local = ["development", "test"].includes(environment) && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.origin !== raw || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) throw new Error("TWE_PUBLIC_SITE_ORIGIN must be an exact HTTPS origin.");
  return url.origin;
}

export function readContinuationConfig(env = process.env) {
  const environment = env.APP_ENV || "development";
  const supplied = Boolean(env.TWE_ENQUIRY_CONTINUATION_SECRET || env.TWE_PUBLIC_SITE_ORIGIN);
  if (!supplied && ["development", "test"].includes(environment)) return null;
  return Object.freeze({
    secret: decodeSecret(env.TWE_ENQUIRY_CONTINUATION_SECRET),
    origin: readOrigin(env.TWE_PUBLIC_SITE_ORIGIN, environment),
  });
}

export function createContinuationLinks({ secret, origin, clock = Date.now, ttlMs = CONTINUATION_TTL_MS }) {
  const key = Buffer.isBuffer(secret) ? secret : decodeSecret(secret);
  const siteOrigin = readOrigin(origin, origin?.startsWith("http://") ? "development" : "production");
  if (ttlMs !== CONTINUATION_TTL_MS) throw new Error("Enquiry continuation links must expire after 14 days.");
  const signature = (message) => createHmac("sha256", key).update(message).digest("base64url");
  return Object.freeze({
    issue(enquiryId, createdAt = clock()) {
      if (!new RegExp(`^${uuidPattern}$`, "i").test(enquiryId)) throw new Error("A valid enquiry ID is required.");
      const created = typeof createdAt === "number" ? createdAt : new Date(createdAt).getTime();
      if (!Number.isFinite(created)) throw new Error("A valid enquiry creation time is required.");
      const expiresAt = Math.floor((created + ttlMs) / 1000);
      const message = `${VERSION}.${enquiryId}.${expiresAt}`;
      const token = `${message}.${signature(message)}`;
      return { token, expiresAt: new Date(expiresAt * 1000).toISOString(), url: `${siteOrigin}/plan-your-trip#continue=${token}` };
    },
    verify(token) {
      const match = tokenPattern.exec(String(token || ""));
      if (!match) return null;
      const [, enquiryId, expiresRaw, supplied] = match;
      const message = `${VERSION}.${enquiryId}.${expiresRaw}`;
      const expected = Buffer.from(signature(message));
      const actual = Buffer.from(supplied);
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
      const expiresAt = Number(expiresRaw) * 1000;
      if (!Number.isSafeInteger(expiresAt) || expiresAt <= clock()) return null;
      return { enquiryId, expiresAt: new Date(expiresAt).toISOString() };
    },
  });
}
