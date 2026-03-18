/* eslint-disable no-undef */
import dotenv from "dotenv";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const normalizeEnvironmentName = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "dev") return "development";
  if (normalized === "prod") return "production";
  return normalized;
};

const parseEnvBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const getRuntimeEnvironment = () =>
  normalizeEnvironmentName(process.env.NODE_ENV || process.env.APP_ENV || "development");

const readEnvValue = (key) => {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
};

const loadEnvironmentConfig = () => {
  if (globalThis.__reebsRuntimeEnvLoaded) return getRuntimeEnvironment();

  // dotenv.config() does not override already-set env vars (e.g. from Netlify),
  // calling it here is safe — it only fills in missing values from .env files.
  const baseEnvironment = dotenv.config();
  if (baseEnvironment.error && baseEnvironment.error.code !== "ENOENT") {
    throw baseEnvironment.error;
  }

  const runtimeEnvironment = getRuntimeEnvironment();
  const envFile = `.env.${runtimeEnvironment}`;
  // Override: false so local .env.* files never clobber platform-injected vars.
  const loadedFile = dotenv.config({ path: envFile, override: false });
  if (loadedFile.error && loadedFile.error.code !== "ENOENT") {
    throw loadedFile.error;
  }

  process.env.APP_ENV = runtimeEnvironment;
  if (!readEnvValue("DATABASE_URL_PRODUCTION") && readEnvValue("DATABASE_URL")) {
    process.env.DATABASE_URL_PRODUCTION = readEnvValue("DATABASE_URL");
  }
  globalThis.__reebsRuntimeEnvLoaded = true;
  return runtimeEnvironment;
};

const normalizeDatabaseIdentity = (value) => {
  try {
    const parsed = new URL(value || "");
    return `${parsed.hostname}:${parsed.port || ""}${parsed.pathname}`;
  } catch {
    return String(value || "").trim();
  }
};

const getConnectionHost = (value) => {
  try {
    return new URL(value || "").hostname || "";
  } catch {
    return "";
  }
};

const readOptionalMultilineEnv = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.replace(/\\n/g, "\n");
};

const pickDatabaseUrl = (environment) => {
  // In production: prefer DATABASE_URL_PRODUCTION, fall back to DATABASE_URL.
  // In development: prefer DATABASE_URL_DEVELOPMENT, fall back to DATABASE_URL
  // so that platform-injected vars (e.g. Netlify) are always honoured.
  const candidates =
    environment === "production"
      ? ["DATABASE_URL_PRODUCTION", "DATABASE_URL"]
      : ["DATABASE_URL_DEVELOPMENT", "DATABASE_URL"];

  for (const key of candidates) {
    const candidate = readEnvValue(key);
    if (candidate) {
      return candidate;
    }
  }

  return "";
};

export const APP_ENV = loadEnvironmentConfig();
export const isProductionRuntime = APP_ENV === "production";

const databaseUrl = pickDatabaseUrl(APP_ENV);
const shouldGuardDatabaseIsolation = parseEnvBoolean(
  process.env.ENFORCE_DATABASE_ISOLATION,
  !isProductionRuntime
);

if (
  databaseUrl &&
  !isProductionRuntime &&
  shouldGuardDatabaseIsolation &&
  process.env.DATABASE_URL_PRODUCTION &&
  normalizeDatabaseIdentity(databaseUrl) ===
    normalizeDatabaseIdentity(process.env.DATABASE_URL_PRODUCTION)
) {
  throw new Error(
    "Refusing to run in development: the selected DATABASE_URL matches DATABASE_URL_PRODUCTION."
  );
}

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
} else if (!isProductionRuntime && !readEnvValue("DATABASE_URL")) {
  // Only remove DATABASE_URL if there is genuinely nothing available —
  // never wipe a value that was already injected by the hosting platform.
  delete process.env.DATABASE_URL;
}

export const DATABASE_URL = process.env.DATABASE_URL || "";

export const resolvePgSslConfig = ({
  connectionString = DATABASE_URL,
  envPrefix = "DATABASE",
} = {}) => {
  const host = getConnectionHost(connectionString);
  const sslMode = readEnvValue(`${envPrefix}_SSL_MODE`).toLowerCase();
  const defaultEnabled = Boolean(host) && !LOCAL_DATABASE_HOSTS.has(host);
  const explicitEnabled = parseEnvBoolean(process.env[`${envPrefix}_SSL`], defaultEnabled);
  const shouldEnableSsl = explicitEnabled && sslMode !== "disable";

  if (!shouldEnableSsl) {
    return false;
  }

  const rejectUnauthorized = parseEnvBoolean(
    process.env[`${envPrefix}_SSL_REJECT_UNAUTHORIZED`],
    true
  );
  const ca = readOptionalMultilineEnv(process.env[`${envPrefix}_SSL_CA`]);

  return ca
    ? {
        rejectUnauthorized,
        ca,
      }
    : { rejectUnauthorized };
};