import "../runtimeEnv.js";

import express from "express";
import { existsSync, readdirSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { APP_ENV, DATABASE_URL, isDeployedRuntime } from "../runtimeEnv.js";
import { buildHealthPayload, checkDatabaseReadiness, checkWaterReadiness, closeHealthPool } from "./health.js";
import { buildResponseHeaders } from "./functions/_shared/http.js";
import { isDatabaseConnectionError } from "./functions/_shared/databaseClient.js";
import { createLogger } from "./functions/_shared/logger.js";
import { REEBS_V1_HANDLER_ALIASES, resolveReebsV1Handler } from "./versionedRoutes.js";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.join(backendDir, "functions");
const FUNCTION_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const PORT = Number(process.env.PORT || process.env.REEBS_API_PORT || 8888);
const logger = createLogger("reebs-api");
const SHUTDOWN_GRACE_MS = Math.max(1_000, Number(process.env.REEBS_SHUTDOWN_GRACE_MS) || 10_000);
const readIntegerSetting = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const API_CONCURRENCY_LIMIT = Math.max(
  1,
  readIntegerSetting(process.env.REEBS_API_CONCURRENCY_LIMIT, 2)
);
const READ_RETRY_LIMIT = Math.max(
  0,
  readIntegerSetting(process.env.REEBS_API_READ_RETRY_LIMIT, 2)
);
const READ_RETRY_DELAY_MS = Math.max(
  0,
  readIntegerSetting(process.env.REEBS_API_READ_RETRY_DELAY_MS, 180)
);

const requestQueue = [];
let activeRequestCount = 0;

const acquireRequestSlot = () => {
  if (activeRequestCount < API_CONCURRENCY_LIMIT) {
    activeRequestCount += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => requestQueue.push(resolve));
};

const releaseRequestSlot = () => {
  const next = requestQueue.shift();
  if (next) {
    next();
    return;
  }
  activeRequestCount = Math.max(0, activeRequestCount - 1);
};

const withRequestSlot = async (operation) => {
  await acquireRequestSlot();
  try {
    return await operation();
  } finally {
    releaseRequestSlot();
  }
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const parseTrustProxySetting = (value) => {
  const normalized = String(value ?? "1").trim().toLowerCase();
  if (!normalized) return 1;
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : normalized;
};

const readFunctionFiles = () => {
  if (!existsSync(functionsDir)) return new Map();

  return new Map(
    readdirSync(functionsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((fileName) => fileName.endsWith(".js"))
      .filter((fileName) => !fileName.endsWith(".test.js") && !fileName.endsWith("_test.js"))
      .map((fileName) => [
        fileName.replace(/\.js$/, ""),
        path.join(functionsDir, fileName),
      ])
  );
};

const functionFiles = readFunctionFiles();
const handlerCache = new Map();
const cacheFunctionHandlers = isDeployedRuntime;

const toPlainHeaders = (headers = {}) => {
  const plainHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      plainHeaders[key] = value.join(", ");
    } else if (value !== undefined && value !== null) {
      plainHeaders[key] = String(value);
    }
  }
  return plainHeaders;
};

const getRequestBaseUrl = (req) => {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.headers.host || `localhost:${PORT}`;
  return `${protocol}://${host}`;
};

const getQueryParameters = (req) => {
  const url = new URL(req.originalUrl || req.url || "/", getRequestBaseUrl(req));
  const queryStringParameters = {};
  const multiValueQueryStringParameters = {};

  for (const [key, value] of url.searchParams.entries()) {
    queryStringParameters[key] = value;
    if (!multiValueQueryStringParameters[key]) {
      multiValueQueryStringParameters[key] = [];
    }
    multiValueQueryStringParameters[key].push(value);
  }

  return {
    rawQueryString: url.searchParams.toString(),
    queryStringParameters,
    multiValueQueryStringParameters,
  };
};

const createEvent = (req, functionName = "") => {
  const headers = toPlainHeaders(req.headers);
  headers["x-request-id"] = req.requestId || headers["x-request-id"] || "";
  if (!headers["x-forwarded-proto"]) {
    headers["x-forwarded-proto"] = req.secure ? "https" : "http";
  }

  const body = typeof req.body === "string"
    ? req.body
    : req.body === undefined
      ? ""
      : JSON.stringify(req.body);
  const query = getQueryParameters(req);

  return {
    httpMethod: req.method,
    headers,
    path: `/api/${functionName}`,
    rawUrl: new URL(req.originalUrl || req.url || "/", getRequestBaseUrl(req)).toString(),
    body,
    isBase64Encoded: false,
    ...query,
  };
};

const applyResponseHeaders = (res, headers = {}) => {
  for (const [name, value] of Object.entries(headers || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      res.setHeader(name, value.map((entry) => String(entry)));
    } else {
      res.setHeader(name, String(value));
    }
  }
};

const applyMultiValueHeaders = (res, multiValueHeaders = {}) => {
  for (const [name, values] of Object.entries(multiValueHeaders || {})) {
    if (!Array.isArray(values)) continue;
    res.setHeader(name, values.map((entry) => String(entry)));
  }
};

const sendFunctionResponse = (res, result = {}) => {
  const statusCode = Number(result.statusCode || result.status || 200);
  applyResponseHeaders(res, result.headers);
  applyMultiValueHeaders(res, result.multiValueHeaders);

  res.status(statusCode);
  if (result.isBase64Encoded) {
    return res.send(Buffer.from(String(result.body || ""), "base64"));
  }

  return res.send(result.body ?? "");
};

const sendJson = (req, res, statusCode, payload, options = {}) => {
  const event = createEvent(req, options.functionName || "");
  res.status(statusCode);
  applyResponseHeaders(
    res,
    {
      "Content-Type": "application/json",
      ...buildResponseHeaders(event, {
        methods: options.methods || "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      }),
    }
  );
  return res.send(JSON.stringify(payload));
};

const loadHandler = async (functionName) => {
  if (!FUNCTION_NAME_PATTERN.test(functionName)) return null;
  if (cacheFunctionHandlers && handlerCache.has(functionName)) return handlerCache.get(functionName);

  const functionFile = functionFiles.get(functionName);
  if (!functionFile) return null;

  const functionUrl = pathToFileURL(functionFile);
  if (!cacheFunctionHandlers) {
    functionUrl.searchParams.set("updated", String(statSync(functionFile).mtimeMs));
  }
  const module = await import(functionUrl.href);
  const handler = typeof module.handler === "function" ? module.handler : null;
  if (cacheFunctionHandlers) handlerCache.set(functionName, handler);
  return handler;
};

const dispatchFunctionRequest = async (req, res, functionNameInput) => {
  const functionName = String(functionNameInput || "").trim();
  const event = createEvent(req, functionName);

  try {
    const handler = await loadHandler(functionName);
    if (!handler) {
      return sendJson(req, res, 404, {
        error: "API function not found.",
        functionName,
      }, { functionName });
    }

    const result = await withRequestSlot(async () => {
      let currentResult = null;
      for (let attempt = 0; attempt <= READ_RETRY_LIMIT; attempt += 1) {
        currentResult = await handler(event, {});
        const statusCode = Number(currentResult?.statusCode || currentResult?.status || 200);
        const shouldRetry = req.method === "GET" && statusCode >= 500;
        if (!shouldRetry || attempt === READ_RETRY_LIMIT) return currentResult;
        await wait(READ_RETRY_DELAY_MS * (2 ** attempt));
      }
      return currentResult;
    });
    return sendFunctionResponse(res, result);
  } catch (error) {
    logger.error({
      requestId: req.requestId,
      functionName,
      err: error,
      code: error?.code || undefined,
    }, "REEBS API function failed");
    return sendJson(req, res, 500, {
      error: "Unexpected API error.",
    }, { functionName });
  }
};

export const createReebsApiServer = () => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxySetting(process.env.TRUST_PROXY_HOPS));
  app.use((req, res, next) => {
    const suppliedRequestId = String(req.headers["x-request-id"] || "").trim();
    req.requestId = /^[A-Za-z0-9._:-]{1,120}$/.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });
  app.use(express.text({ type: "*/*", limit: process.env.REEBS_API_BODY_LIMIT || "10mb" }));

  app.get(["/live", "/api/live"], (req, res) =>
    sendJson(req, res, 200, {
      ok: true,
      service: "reebs-api",
      status: "alive",
      timestamp: new Date().toISOString(),
    })
  );

  app.get(["/health", "/api/health"], async (req, res) => {
    const database = await checkDatabaseReadiness();
    return sendJson(req, res, 200, {
      ...buildHealthPayload({ database }),
      adapter: "api-handler-adapter",
      functions: functionFiles.size,
    });
  });

  app.get(["/ready", "/api/ready"], async (req, res) => {
    const database = await checkDatabaseReadiness();
    const payload = buildHealthPayload({ database });
    return sendJson(req, res, payload.ok ? 200 : 503, payload);
  });

  app.get(["/health/water", "/api/health/water"], async (req, res) => {
    const database = await checkDatabaseReadiness();
    const water = database.reachable ? await checkWaterReadiness() : { status: "unavailable", ready: false };
    const payload = buildHealthPayload({ database, water, includeWater: true });
    return sendJson(req, res, payload.ok ? 200 : 503, payload);
  });

  app.get(["/", "/api"], (req, res) =>
    sendJson(req, res, 200, {
      ok: true,
      service: "reebs-api",
      adapter: "api-handler-adapter",
      health: "/health",
      api: "/api/:functionName",
      functions: functionFiles.size,
    })
  );

  app.all("/api/webhooks/railway", (req, res) =>
    dispatchFunctionRequest(req, res, "railwayEvents")
  );

  app.all("/api/webhook/railway", (req, res) =>
    dispatchFunctionRequest(req, res, "railwayEvents")
  );

  app.all(Object.keys(REEBS_V1_HANDLER_ALIASES), (req, res, next) => {
    const requestPath = new URL(
      req.originalUrl || req.url || "/",
      getRequestBaseUrl(req)
    ).pathname;
    const functionName = resolveReebsV1Handler(requestPath);
    if (!functionName) return next();
    return dispatchFunctionRequest(req, res, functionName);
  });

  app.all("/api/:functionName", (req, res) =>
    dispatchFunctionRequest(req, res, req.params.functionName)
  );

  app.use((req, res) =>
    sendJson(req, res, 404, {
      error: "Route not found.",
    })
  );

  return app;
};

export const validateDeployedRuntime = ({
  appEnvironment = APP_ENV,
  databaseUrl = DATABASE_URL,
  userAppSecret = process.env.USER_APP_SECRET,
  paystackSecretKey = process.env.PAYSTACK_SECRET_KEY,
} = {}) => {
  if (!new Set(["staging", "production"]).has(appEnvironment)) return;
  const failures = [];
  if (!databaseUrl) failures.push("DATABASE_URL");
  if (String(userAppSecret || "").trim().length < 32) {
    failures.push("USER_APP_SECRET (minimum 32 characters)");
  }
  const paystackKeyType = String(paystackSecretKey || "").trim().toLowerCase();
  if (appEnvironment === "staging" && paystackKeyType.startsWith("sk_live_")) {
    failures.push("PAYSTACK_SECRET_KEY must use Paystack test credentials in staging");
  }
  if (appEnvironment === "production" && paystackKeyType.startsWith("sk_test_")) {
    failures.push("PAYSTACK_SECRET_KEY must use Paystack live credentials in production");
  }
  if (failures.length) {
    throw new Error(
      `REEBS ${appEnvironment} startup blocked: invalid or missing mandatory configuration: ${failures.join(", ")}.`
    );
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateDeployedRuntime();
  const app = createReebsApiServer();
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, environment: APP_ENV }, "REEBS API listening");
  });
  globalThis.__reebsApiServer = server;

  let shuttingDown = false;
  const shutdown = async (signal, error = null) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger[error ? "error" : "info"]({ signal, err: error || undefined }, "REEBS API shutting down");

    const forceTimer = setTimeout(() => {
      logger.error({ signal }, "REEBS API shutdown grace period exceeded");
      server.closeAllConnections?.();
      process.exitCode = 1;
    }, SHUTDOWN_GRACE_MS);
    forceTimer.unref?.();

    await new Promise((resolve) => server.close(resolve));
    await closeHealthPool().catch((poolError) => {
      logger.error({ err: poolError }, "REEBS health pool close failed");
      process.exitCode = 1;
    });
    clearTimeout(forceTimer);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("unhandledRejection", (error) => void shutdown("unhandledRejection", error));
  process.on("uncaughtException", (error) => {
    if (isDatabaseConnectionError(error)) {
      logger.error({
        err: error,
        code: error?.code || undefined,
        eventName: "database.unhandled_connection_error",
      }, "Recovered an unhandled database connection error");
      return;
    }
    void shutdown("uncaughtException", error);
  });
}
