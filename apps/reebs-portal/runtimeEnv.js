/* eslint-disable no-undef */
import {
  isDeployedEnvironment,
  isProductionEnvironment,
  resolveAppEnvironment,
} from "@faako/config";
import dotenv from "dotenv";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const parseEnvBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const readEnvValue = (key) => {
  const value = process.env[key];
  return typeof value === "string" ? value.trim() : "";
};

const loadEnvironmentConfig = () => {
  if (globalThis.__reebsRuntimeEnvLoaded) {
    return resolveAppEnvironment(process.env);
  }

  const initialEnvironment = resolveAppEnvironment(process.env);
  const skipEnvironmentFiles = parseEnvBoolean(process.env.REEBS_SKIP_ENV_FILES, false);

  // Railway staging and production receive configuration from the platform.
  // Local dotenv files are development-only and never supplement a deployed runtime.
  if (initialEnvironment === "development" && !skipEnvironmentFiles) {
    const baseEnvironment = dotenv.config();
    if (baseEnvironment.error && baseEnvironment.error.code !== "ENOENT") {
      throw baseEnvironment.error;
    }

    const loadedFile = dotenv.config({ path: ".env.development", override: false });
    if (loadedFile.error && loadedFile.error.code !== "ENOENT") {
      throw loadedFile.error;
    }
  }

  const runtimeEnvironment = resolveAppEnvironment(process.env);
  process.env.APP_ENV = runtimeEnvironment;
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

export const isValidDatabaseUrl = (value) => {
  try {
    const parsed = new URL(value || "");
    return ["postgres:", "postgresql:"].includes(parsed.protocol)
      && Boolean(parsed.hostname)
      && parsed.pathname.length > 1;
  } catch {
    return false;
  }
};

const readOptionalMultilineEnv = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.replace(/\\n/g, "\n");
};

const pickDatabaseUrl = (environment) => {
  // Deployed environments use Railway's environment-scoped DATABASE_URL.
  // The production alias remains a final compatibility fallback for intentional
  // production maintenance outside Railway; staging never consumes it.
  const candidates = environment === "development"
    ? ["DATABASE_URL_DEVELOPMENT", "DATABASE_URL"]
    : environment === "production"
      ? ["DATABASE_URL", "DATABASE_URL_PRODUCTION"]
      : ["DATABASE_URL"];

  for (const key of candidates) {
    const candidate = readEnvValue(key);
    if (candidate) {
      return candidate;
    }
  }

  return "";
};

export const APP_ENV = loadEnvironmentConfig();
export const isDevelopmentRuntime = APP_ENV === "development";
export const isStagingRuntime = APP_ENV === "staging";
export const isProductionRuntime = isProductionEnvironment(APP_ENV);
export const isDeployedRuntime = isDeployedEnvironment(APP_ENV);

const databaseUrl = pickDatabaseUrl(APP_ENV);
if (isDeployedRuntime && databaseUrl && !isValidDatabaseUrl(databaseUrl)) {
  throw new Error(`Refusing to run in ${APP_ENV}: DATABASE_URL is not a valid PostgreSQL URL.`);
}
if (isDeployedRuntime && databaseUrl && LOCAL_DATABASE_HOSTS.has(getConnectionHost(databaseUrl))) {
  throw new Error(`Refusing to run in ${APP_ENV}: DATABASE_URL points to a local database host.`);
}
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
    `Refusing to run in ${APP_ENV}: the selected DATABASE_URL matches DATABASE_URL_PRODUCTION.`
  );
}

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
} else if (!isDeployedRuntime && !readEnvValue("DATABASE_URL")) {
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
