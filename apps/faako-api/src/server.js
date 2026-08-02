import express from "express";
import cors from "cors";
import { createRequire } from "node:module";
import {
  createFaakoApiSecurityHeadersMiddleware,
  isFaakoApiAllowedOrigin,
} from "./security/securityHeaders.js";
import { createDemoAccessHandler } from "./demoAccess.js";
import {
  createCompatibleErrorResponse,
  errorCodeForStatus,
} from "@faako/api-contracts";
import {
  createLogger,
  createRequestContextMiddleware,
} from "@faako/logger";

const require = createRequire(import.meta.url);
const { handler: signupHandler } = require("./signup.cjs");

const app = express();
const port = process.env.PORT || 8889;
const logger = createLogger("faako-api", {
  component: "server",
  environment: process.env.APP_ENV || process.env.NODE_ENV,
});

app.disable("x-powered-by");
app.use(
  createRequestContextMiddleware({
    application: "faako-api",
    component: "http",
    environment: process.env.APP_ENV || process.env.NODE_ENV,
  })
);
app.use(createFaakoApiSecurityHeadersMiddleware());
app.use(
  cors({
    origin: (origin, callback) => callback(null, isFaakoApiAllowedOrigin(origin)),
  })
);

app.use(
  express.text({
    type: ["application/json", "application/x-www-form-urlencoded"],
    limit: "64kb",
  })
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "faako-api" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "faako-api" });
});

const handleSignup = async (req, res) => {
  const result = await signupHandler({
    httpMethod: "POST",
    headers: req.headers,
    body: req.body,
  });

  Object.entries(result.headers || {}).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  return res.status(result.statusCode || 200).send(result.body || "");
};

app.post(["/api/signup", "/signup"], handleSignup);
app.post("/api/demo-access", express.json({ limit: "8kb" }), createDemoAccessHandler());

app.use((req, res) => {
  res.status(404).json(
    createCompatibleErrorResponse(
      {
        code: errorCodeForStatus(404),
        message: "Route not found.",
      },
      { requestId: req.requestId },
    ),
  );
});

app.use((error, req, res, _next) => {
  logger.error(
    {
      err: error,
      eventName: "api.request.failed",
      requestId: req.requestId,
      method: req.method,
      path: String(req.originalUrl || "").split("?")[0],
    },
    "Unhandled Faako API error",
  );
  res.status(500).json(
    createCompatibleErrorResponse(
      {
        code: errorCodeForStatus(500),
        message: "The service could not complete the request.",
      },
      { requestId: req.requestId },
    ),
  );
});

app.listen(port, () => {
  logger.info(
    { eventName: "server.started", port },
    "Faako API listening",
  );
});
