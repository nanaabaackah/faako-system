import {
  createExpressSecurityHeadersMiddleware,
  isAllowedOrigin,
  mergeAllowedOrigins,
} from "@faako/security";
import appSystem from "../../appSystem.js";

const parseOriginEnv = (...keys) =>
  keys
    .flatMap((key) => String(process.env[key] || "").split(","))
    .map((origin) => origin.trim())
    .filter(Boolean);

export const FAAKO_API_ALLOWED_ORIGINS = mergeAllowedOrigins(
  appSystem.security.allowedOrigins,
  parseOriginEnv("ALLOWED_ORIGIN", "CORS_ORIGINS", "FAAKO_API_ALLOWED_ORIGINS"),
);

export const FAAKO_API_SECURITY_HEADER_BASELINE = [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
];

const isCloudflarePagesPreviewOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".pages.dev");
  } catch {
    return false;
  }
};

export const isFaakoApiAllowedOrigin = (origin) =>
  !origin ||
  isAllowedOrigin(origin, FAAKO_API_ALLOWED_ORIGINS) ||
  isCloudflarePagesPreviewOrigin(origin);

export const createFaakoApiSecurityHeadersMiddleware = () =>
  createExpressSecurityHeadersMiddleware({
    profileId: appSystem.security.profileId,
    allowedOrigins: FAAKO_API_ALLOWED_ORIGINS,
  });
