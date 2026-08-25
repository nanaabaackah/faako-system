import "../runtimeEnv.js";

import express from "express";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createLogger,
  createRequestContextMiddleware,
} from "@faako/logger";
import { json } from "./functions/_shared/http.js";
import { REEBS_V1_HANDLER_ALIASES } from "./versionedRoutes.js";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.join(backendDir, "functions");
const FUNCTION_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const PORT = Number(process.env.PORT || process.env.REEBS_API_PORT || 8888);
const apiLogger = createLogger("reebs-portal", {
  component: "api-adapter",
  environment: process.env.APP_ENV || process.env.NODE_ENV,
});
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
const handlerMtimes = new Map();

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
  const result = json(event, statusCode, payload, {
    methods: options.methods || "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  });
  res.status(result.statusCode);
  applyResponseHeaders(res, result.headers);
  return res.send(result.body);
};

const loadHandler = async (functionName) => {
  if (!FUNCTION_NAME_PATTERN.test(functionName)) return null;

  const functionFile = functionFiles.get(functionName);
  if (!functionFile) return null;

  const currentMtime = statSync(functionFile).mtimeMs;
  const cachedHandler = handlerCache.get(functionName);
  const cachedMtime = handlerMtimes.get(functionName);
  if (cachedHandler && cachedMtime === currentMtime) {
    return cachedHandler;
  }

  const module = await import(`${pathToFileURL(functionFile).href}?t=${currentMtime}`);
  const handler = typeof module.handler === "function" ? module.handler : null;
  handlerCache.set(functionName, handler);
  handlerMtimes.set(functionName, currentMtime);
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
    (req.log || apiLogger).error(
      {
        err: error,
        eventName: "api.function.failed",
        functionName,
        requestId: req.requestId,
      },
      "REEBS API function failed"
    );
    return sendJson(req, res, 500, {
      error: "Unexpected API error.",
    }, { functionName });
  }
};

export const createReebsApiServer = () => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxySetting(process.env.TRUST_PROXY_HOPS));
  app.use(
    createRequestContextMiddleware({
      application: "reebs-portal",
      component: "api-adapter",
      environment: process.env.APP_ENV || process.env.NODE_ENV,
    })
  );
  app.use(express.text({ type: "*/*", limit: process.env.REEBS_API_BODY_LIMIT || "10mb" }));

  app.get(["/health", "/api/health"], (req, res) =>
    sendJson(req, res, 200, {
      ok: true,
      service: "reebs-api",
      adapter: "api-handler-adapter",
      functions: functionFiles.size,
      concurrencyLimit: API_CONCURRENCY_LIMIT,
      readRetryLimit: READ_RETRY_LIMIT,
    })
  );

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

  for (const [route, functionName] of Object.entries(REEBS_V1_HANDLER_ALIASES)) {
    app.all(route, (req, res) => dispatchFunctionRequest(req, res, functionName));
  }

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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = createReebsApiServer();
  const server = app.listen(PORT, () => {
    apiLogger.info(
      { eventName: "server.started", port: PORT },
      "REEBS API listening"
    );
  });
  globalThis.__reebsApiServer = server;
}
