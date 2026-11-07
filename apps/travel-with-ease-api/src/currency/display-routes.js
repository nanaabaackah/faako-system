import { Router } from "express";
import {
  createErrorResponse,
  createSuccessResponse,
} from "@faako/api-contracts";

// A display-only rate, not a quote, transaction endpoint or arbitrary conversion API.
export function currencyDisplayRoutes(service, { now = Date.now } = {}) {
  const router = Router();
  const pending = new Map();
  const failures = new Map();
  router.get("/", async (req, res) => {
    if (!service)
      return res.status(503).json(
        createErrorResponse(
          {
            code: "service_unavailable",
            message:
              "Currency estimates are unavailable. Prices remain in GHS.",
          },
          { requestId: req.requestId },
        ),
      );
    const currency = req.query.currency;
    if (
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency) ||
      Object.keys(req.query).some((key) => key !== "currency") ||
      !service?.getSupportedCurrencies().includes(currency)
    ) {
      return res.status(400).json(
        createErrorResponse(
          {
            code: "validation_error",
            message: "Choose a supported display currency.",
          },
          { requestId: req.requestId },
        ),
      );
    }
    try {
      if ((failures.get(currency) || 0) > now())
        throw new Error("Rate temporarily unavailable.");
      if (!pending.has(currency)) {
        pending.set(currency, service.getLatestRate("GHS", currency));
      }
      const result = await pending.get(currency);
      const age = now() - Date.parse(result.providerTimestamp);
      if (
        !/^\d{1,8}(?:\.\d{1,12})?$/.test(result.rate) ||
        Number(result.rate) <= 0 ||
        !Number.isFinite(age) ||
        age < -300_000 ||
        age > 72 * 60 * 60_000
      ) {
        throw new Error("Rate is invalid or too old.");
      }
      failures.delete(currency);
      res.setHeader("Cache-Control", "public, max-age=300");
      return res.json(
        createSuccessResponse(
          {
            baseCurrency: "GHS",
            currency,
            rate: result.rate,
            updatedAt: new Date(result.providerTimestamp).toISOString(),
            stale: Boolean(result.stale) || age > 36 * 60 * 60_000,
            provider: "exchange-rate-api",
            indicative: true,
          },
          { requestId: req.requestId },
        ),
      );
    } catch {
      failures.set(currency, now() + 30_000);
      return res.status(503).json(
        createErrorResponse(
          {
            code: "service_unavailable",
            message:
              "Currency estimates are unavailable. Prices remain in GHS.",
          },
          { requestId: req.requestId },
        ),
      );
    } finally {
      pending.delete(currency);
    }
  });
  return router;
}
