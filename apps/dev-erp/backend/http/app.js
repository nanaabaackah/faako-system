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
  app.use(cors(corsOptions));
  app.use(
    express.json({
      limit: "1mb",
    })
  );
  app.use(securityHeaders);
  app.use("/api", apiRequestLogger);
  app.use("/api", apiRateLimit);
  app.use("/api/auth/login", authRateLimit);
  app.use("/api/auth/forgot-password", authRateLimit);
  app.use("/api/public/bookings", publicBookingRateLimit);
  app.use("/api/ai/productivity-coach", aiRateLimit);
  app.use("/api", csrfMiddleware);
  app.use("/api", capabilityAccessMiddleware);
};

export const registerApiFallbackRoute = (app) => {
  app.use("/api", (req, res) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl}`,
    });
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

export const registerErrorHandler = (app, { classifyApiError, isProduction }) => {
  app.use((err, req, res, _next) => {
    void _next;
    if (res.headersSent) return;

    const isApiRequest = String(req?.originalUrl || "").startsWith("/api");
    const { status, message, code } = classifyApiError(err);

    if (status >= 500) {
      console.error(`Unhandled API error: ${req.method} ${req.originalUrl}`, err);
    }

    if (isApiRequest) {
      const payload = { error: message };
      if (!isProduction && code) {
        payload.code = code;
      }
      res.status(status).json(payload);
      return;
    }

    res.status(status).send(status >= 500 ? "Internal Server Error" : message);
  });
};
