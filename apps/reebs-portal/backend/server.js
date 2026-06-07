/* eslint-disable no-undef */
import "../runtimeEnv.js";

import express from "express";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildResponseHeaders } from "../netlify/functions/_shared/http.js";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(backendDir, "..");
const functionsDir = path.join(appRoot, "netlify", "functions");
const FUNCTION_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;
const PORT = Number(process.env.PORT || process.env.REEBS_API_PORT || 8888);

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
    path: `/.netlify/functions/${functionName}`,
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
  if (handlerCache.has(functionName)) return handlerCache.get(functionName);

  const functionFile = functionFiles.get(functionName);
  if (!functionFile) return null;

  const module = await import(pathToFileURL(functionFile).href);
  const handler = typeof module.handler === "function" ? module.handler : null;
  handlerCache.set(functionName, handler);
  return handler;
};

export const createReebsApiServer = () => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", parseTrustProxySetting(process.env.TRUST_PROXY_HOPS));
  app.use(express.text({ type: "*/*", limit: process.env.REEBS_API_BODY_LIMIT || "10mb" }));

  app.get(["/health", "/api/health"], (req, res) =>
    sendJson(req, res, 200, {
      ok: true,
      service: "reebs-api",
      adapter: "netlify-function-compat",
      functions: functionFiles.size,
    })
  );

  app.all(["/api/:functionName", "/.netlify/functions/:functionName"], async (req, res) => {
    const functionName = String(req.params.functionName || "").trim();
    const event = createEvent(req, functionName);

    try {
      const handler = await loadHandler(functionName);
      if (!handler) {
        return sendJson(req, res, 404, {
          error: "API function not found.",
          functionName,
        }, { functionName });
      }

      const result = await handler(event, {});
      return sendFunctionResponse(res, result);
    } catch (error) {
      console.error("REEBS API function failed", {
        functionName,
        message: error?.message || String(error),
        code: error?.code || undefined,
      });
      return sendJson(req, res, 500, {
        error: "Unexpected API error.",
      }, { functionName });
    }
  });

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
    console.log(`REEBS API listening on http://localhost:${PORT}`);
  });
  globalThis.__reebsApiServer = server;
}
