import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createErrorResponse, createRequestId, createSuccessResponse } from "@faako/api-contracts";
import { createExpressSecurityHeadersMiddleware } from "@faako/security";
import { estimateSchema, inquirySchema } from "./validation.js";

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
};

const createLimiter = ({ limit, windowMs }) => {
  const clients = new Map();
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const current = clients.get(key);
    const state = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    state.count += 1;
    clients.set(key, state);
    if (state.count <= limit) return next();
    const retryAfterSeconds = Math.ceil((state.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json(createErrorResponse({ code: "rate_limited", message: "Too many requests. Please try again shortly." }, { requestId: req.requestId, retryAfterSeconds }));
  };
};

const issuesFor = (error) => error.issues.map((issue) => ({ field: issue.path.join("."), code: issue.code, message: issue.message }));

export const createApp = ({ repository, estimatorService, allowedOrigins = [], agentToken = "", environment = "test", logger = console }) => {
  if (environment === "production" && !agentToken) throw new Error("Approved production staff authentication is required.");
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", environment === "production" ? 1 : false);
  app.use((req, res, next) => {
    req.requestId = createRequestId();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  });
  app.use(createExpressSecurityHeadersMiddleware({ allowedOrigins }));
  app.options("*splat", (_req, res) => res.sendStatus(204));
  app.use(express.json({ limit: "32kb" }));

  app.get("/healthz", (_req, res) => res.json({ ok: true, service: "travel-with-ease-api" }));

  const publicLimiter = createLimiter({ limit: 40, windowMs: 10 * 60_000 });
  app.post("/api/public/estimate", publicLimiter, async (req, res) => {
    const parsed = estimateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(createErrorResponse({ code: "validation_error", message: "Check the trip details.", issues: issuesFor(parsed.error) }, { requestId: req.requestId }));
    try {
      return res.json(createSuccessResponse(await estimatorService.estimate(parsed.data), { requestId: req.requestId }));
    } catch (error) {
      logger.error?.({ requestId: req.requestId, error: error?.message }, "Currency estimate unavailable");
      return res.status(503).json(createErrorResponse({ code: "service_unavailable", message: "Live estimate rates are temporarily unavailable. Please try again." }, { requestId: req.requestId }));
    }
  });

  app.post("/api/public/inquiries", publicLimiter, async (req, res) => {
    const parsed = inquirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(createErrorResponse({ code: "validation_error", message: "Check the inquiry details.", issues: issuesFor(parsed.error) }, { requestId: req.requestId }));
    if (parsed.data.website) return res.status(202).json(createSuccessResponse({ received: true }, { requestId: req.requestId }));
    try {
      const estimate = await estimatorService.estimate(parsed.data);
      const now = new Date().toISOString();
      const record = {
        id: randomUUID(), stage: "new", createdAt: now, updatedAt: now,
        contact: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone },
        inquiry: {
          id: randomUUID(), source: "website_estimator", destination: parsed.data.destination,
          travellers: parsed.data.travellers, nights: parsed.data.nights, travelDate: parsed.data.travelDate,
          accommodation: parsed.data.accommodation, tripStyle: parsed.data.tripStyle,
          activities: parsed.data.activities, flightPreference: parsed.data.flightPreference,
          notes: parsed.data.notes, consentAt: now, estimate,
        },
      };
      await repository.createLeadWithInquiry(record);
      return res.status(201).json(createSuccessResponse({ inquiryId: record.inquiry.id, status: "received" }, { requestId: req.requestId }));
    } catch (error) {
      logger.error?.({ requestId: req.requestId, error: error?.message }, "Inquiry creation failed");
      return res.status(503).json(createErrorResponse({ code: "service_unavailable", message: "We could not save your inquiry. Please try again." }, { requestId: req.requestId }));
    }
  });

  app.get("/api/agent/leads", async (req, res) => {
    const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!agentToken || !safeEqual(supplied, agentToken)) return res.status(401).json(createErrorResponse({ code: "authentication_error", message: "Authentication is required." }, { requestId: req.requestId }));
    return res.json(createSuccessResponse({ items: await repository.listLeads() }, { requestId: req.requestId }));
  });

  app.use((_req, res) => res.status(404).json(createErrorResponse({ code: "not_found", message: "Route not found." })));
  return app;
};
