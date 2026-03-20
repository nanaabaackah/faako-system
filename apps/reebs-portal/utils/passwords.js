import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(crypto.scrypt);
const SALT_BYTES = 16;
const KEY_LENGTH = 64;
const HASH_PREFIX = "scrypt";

const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const parseHash = (stored) => {
  if (typeof stored !== "string") return null;
  const parts = stored.split("$");
  if (parts.length !== 3) return null;
  if (parts[0] !== HASH_PREFIX) return null;
  return { salt: parts[1], hash: parts[2] };
};

export const hashPassword = async (password) => {
  if (typeof password !== "string" || !password.trim()) {
    throw new Error("Password must be a non-empty string.");
  }

  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `${HASH_PREFIX}$${salt.toString("base64")}$${derived.toString("base64")}`;
};

export const verifyPassword = async (password, stored) => {
  const parsed = parseHash(stored);
  if (!parsed) {
    const isValid = safeEqual(password, stored || "");
    return { isValid, needsRehash: isValid };
  }

  const salt = Buffer.from(parsed.salt, "base64");
  const hash = Buffer.from(parsed.hash, "base64");
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  const isValid = hash.length === derived.length && crypto.timingSafeEqual(hash, derived);
  return { isValid, needsRehash: false };
};
