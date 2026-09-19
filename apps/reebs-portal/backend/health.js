import { Pool } from "pg";
import { DATABASE_URL, resolvePgSslConfig } from "../runtimeEnv.js";

const HEALTH_TIMEOUT_MS = Math.max(250, Number(process.env.REEBS_HEALTH_TIMEOUT_MS) || 2_000);
const BUILD_REFERENCE = String(
  process.env.REEBS_BUILD_REFERENCE
    || process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.CF_PAGES_COMMIT_SHA
    || process.env.COMMIT_SHA
    || "development"
).trim().slice(0, 64);

let healthPool = null;

const getHealthPool = () => {
  if (!DATABASE_URL) return null;
  if (!healthPool) {
    healthPool = new Pool({
      connectionString: DATABASE_URL,
      ssl: resolvePgSslConfig(),
      max: 1,
      connectionTimeoutMillis: HEALTH_TIMEOUT_MS,
      idleTimeoutMillis: 5_000,
    });
  }
  return healthPool;
};

const withTimeout = async (operation, timeoutMs = HEALTH_TIMEOUT_MS) => {
  let timeoutId;
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("health_check_timeout")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getBuildReference = () => BUILD_REFERENCE;

export const checkDatabaseReadiness = async ({ query } = {}) => {
  const pool = getHealthPool();
  const runQuery = query || (pool ? (text) => pool.query(text) : null);
  if (!runQuery) return { status: "unavailable", reachable: false, reason: "not_configured" };

  try {
    await withTimeout(() => runQuery("SELECT 1"));
    return { status: "ready", reachable: true };
  } catch {
    return { status: "unavailable", reachable: false, reason: "connection_failed" };
  }
};

export const checkWaterReadiness = async ({ query } = {}) => {
  const pool = getHealthPool();
  const runQuery = query || (pool ? (text) => pool.query(text) : null);
  if (!runQuery) return { status: "unavailable", ready: false, reason: "database_not_configured" };

  try {
    const result = await withTimeout(() => runQuery(
      `SELECT EXISTS (
         SELECT 1
         FROM "waterProductConfig"
         WHERE "productKey" = 'gwater-15pk'
           AND "retailSinglePrice" > 0
           AND "costPrice" > 0
       ) AS ready`
    ));
    const ready = Boolean(result?.rows?.[0]?.ready);
    return ready
      ? { status: "ready", ready: true }
      : { status: "unavailable", ready: false, reason: "commercial_config_missing" };
  } catch {
    return { status: "unavailable", ready: false, reason: "query_failed" };
  }
};

export const buildHealthPayload = ({ database, water, includeWater = false } = {}) => {
  const databaseReady = database?.reachable === true;
  const waterReady = !includeWater || water?.ready === true;
  return {
    ok: databaseReady && waterReady,
    service: "reebs-api",
    status: databaseReady && waterReady ? "ready" : "degraded",
    version: BUILD_REFERENCE,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: database?.status || "not_checked",
      ...(includeWater ? { water: water?.status || "not_checked" } : {}),
    },
  };
};

export const closeHealthPool = async () => {
  const pool = healthPool;
  healthPool = null;
  if (pool) await pool.end();
};
