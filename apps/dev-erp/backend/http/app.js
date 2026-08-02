import {
  createCompatibleErrorResponse,
  errorCodeForStatus,
} from "@faako/api-contracts";
import { createRequestContextMiddleware } from "@faako/logger";

export const configureBaseHttpMiddleware = (
  app,
  {
    cors,
    express,
    corsOptions,
    securityHeaders,
    apiRequestLogger,
    apiRateLimit,
    authRateLimit,
    publicBookingRateLimit,
    aiRateLimit,
    csrfMiddleware,
    capabilityAccessMiddleware,
  }
) => {
  app.use(
    createRequestContextMiddleware({
      application: "dev-erp",
      environment: process.env.APP_ENV || process.env.NODE_ENV,
    })
  );

  // Allow /api/v1/* as an alias for /api/* so clients can adopt versioned URLs
  // without requiring route changes. Strip the version segment before routing.
  app.use((req, _res, next) => {
    if (req.url.startsWith("/api/v1/")) {
      req.url = "/api/" + req.url.slice("/api/v1/".length);
    }
    next();
  });

  app.use(cors(corsOptions));
  app.use(securityHeaders);
  app.use(
    express.json({
      limit: "1mb",
      verify: (req, _res, buffer) => {
        if (String(req.originalUrl || req.url || "").startsWith("/api/webhooks/trello/")) {
          req.rawBody = Buffer.from(buffer);
        }
      },
    })
  );
  app.use("/api", apiRequestLogger);
  app.use("/api", apiRateLimit);
  app.use("/api/auth/login", authRateLimit);
  app.use("/api/auth/forgot-password", authRateLimit);
  app.use("/api/public/bookings", publicBookingRateLimit);
  app.use("/api/ai/productivity-coach", aiRateLimit);
  app.use("/api/ai/system-health-diagnosis", aiRateLimit);
  app.use("/api", csrfMiddleware);
  app.use("/api", capabilityAccessMiddleware);
};

export const registerApiFallbackRoute = (app) => {
  app.use("/api", (req, res) => {
    res.status(404).json(
      createCompatibleErrorResponse(
        {
          code: errorCodeForStatus(404),
          message: "API route not found.",
        },
        {
          requestId: req.requestId,
          legacy: {
            method: req.method,
            path: String(req.originalUrl || "").split("?")[0],
          },
        },
      )
    );
  });
};

export const registerHealthRoute = (app, { environment }) => {
  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      environment,
      timestamp: new Date().toISOString(),
    });
  });
};

export const registerErrorHandler = (app, { classifyApiError, isProduction, logger }) => {
  app.use((err, req, res, _next) => {
    void _next;
    if (res.headersSent) return;

    const isApiRequest = String(req?.originalUrl || "").startsWith("/api");
    const { status, message, code } = classifyApiError(err);

    if (status >= 500) {
      const log = logger ?? console;
      log.error(
        {
          err,
          eventName: "api.request.failed",
          method: req.method,
          path: String(req.originalUrl || "").split("?")[0],
          requestId: req.requestId,
          organisationId: req.user?.organizationId,
          userId: req.user?.userId,
        },
        "Unhandled API error"
      );
    }

    if (isApiRequest) {
      void isProduction;
      void code;
      res.status(status).json(
        createCompatibleErrorResponse(
          {
            code: errorCodeForStatus(status),
            message,
          },
          { requestId: req.requestId }
        )
      );
      return;
    }

    res.status(status).send(status >= 500 ? "Internal Server Error" : message);
  });
};
