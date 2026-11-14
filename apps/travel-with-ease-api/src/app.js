import express from "express";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createErrorResponse, resolveRequestId, createSuccessResponse } from "@faako/api-contracts";
import { createLogger } from "@faako/logger";
import { assertApiStartup } from "./staging-startup.js";
import { createInlinePortal } from "./portal/inline.js";
import { contentRoutes } from "./content/routes.js";
import { enquiriesRoutes } from "./enquiries/routes.js";
import { mediaRoutes } from "./media/routes.js";
import { EmailTemplates, emailTemplateRoutes } from "./notifications/templates.js";
import { createSecurityHeaders } from "./security/securityHeaders.js";
import { estimateSchema, inquirySchema, nativeInquirySchema, smartEnquirySchema } from "./validation.js";
import { TurnstileError } from "./enquiries/turnstile.js";
import { currencyDisplayRoutes } from "./currency/display-routes.js";
import { z } from "zod";

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
};

export const createLimiter = ({ limit, windowMs, maxClients = 10_000, clock = Date.now }) => {
  const clients = new Map();
  let nextSweep = 0;
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = clock();
    if (now >= nextSweep) {
      for (const [client, state] of clients) if (state.resetAt <= now) clients.delete(client);
      nextSweep = now + Math.min(windowMs, 60_000);
    }
    if (!clients.has(key) && clients.size >= maxClients) {
      res.setHeader("Retry-After", "60");
      return res.status(429).json(createErrorResponse({ code: "rate_limited", message: "Too many requests. Please try again shortly." }, { requestId: req.requestId, retryAfterSeconds: 60 }));
    }
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

export const createApp = ({ repository, estimatorService, currencyService, contentRepository, publicationRepository, previewService, mediaService, allowedOrigins = [], agentToken = "", staffAuth, startupReceipt, portal = null, environment = "test", turnstileVerifier = null, continuationLinks = null, logger = createLogger("travel-with-ease-api") }) => {
  assertApiStartup({ environment, repository, staffAuth, allowedOrigins, agentToken, startupReceipt });
  if (contentRepository && !staffAuth) throw new Error("CMS requires staff sessions.");
  if (mediaService && !staffAuth) throw new Error("Media requires staff sessions.");
  // This route must never be enabled on production, even if copied env vars exist.

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  app.use((req, res, next) => {
    req.requestId = resolveRequestId(req.headers["x-request-id"]);
    res.setHeader("X-Request-Id", req.requestId);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
  app.use(createSecurityHeaders({ allowedOrigins }));
  const inlinePortal = portal ? createInlinePortal({ ...portal, logger }) : null;
  if (inlinePortal) app.use(inlinePortal.guard);
  app.options(/^\/.*$/, (_req, res) => res.sendStatus(204));
  app.use(express.json({ limit: "32kb" }));
  if (staffAuth) {
    app.use("/api/auth", staffAuth.router);
    app.use("/api/agent", staffAuth.requireStaff);
    app.use("/api/agent/leads", staffAuth.requirePermission("enquiries.read"));
    if (staffAuth.administrationRouter) app.use("/api/agent/administration", staffAuth.administrationRouter);
  }
  if (contentRepository && repository?.pool && repository?.organisationId && staffAuth) app.use("/api/agent/inquiries", enquiriesRoutes({ pool: repository.pool, organisationId: repository.organisationId, auth: staffAuth }));
  if (contentRepository) app.use("/api/agent/content", contentRoutes({ repository: contentRepository, publication: publicationRepository, preview: previewService, auth: staffAuth }));
  if (mediaService) app.use("/api/agent/media", mediaRoutes({ service: mediaService, auth: staffAuth }));
  if (repository?.pool && staffAuth) app.use("/api/agent/templates", emailTemplateRoutes(new EmailTemplates(repository.pool, repository.organisationId), staffAuth));

  app.get("/healthz", (_req, res) => res.json({ ok: true, service: "travel-with-ease-api" }));
  app.get("/readyz", async (req, res) => {
    try {
      if (typeof repository?.ready !== "function") throw new Error("Persistent storage not configured");
      await repository.ready();
      return res.json(createSuccessResponse({ ready: true }, { requestId: req.requestId }));
    } catch {
      return res.status(503).json(createErrorResponse({ code: "service_unavailable", message: "Persistent storage is not ready." }, { requestId: req.requestId }));
    }
  });

  const publicLimiter = createLimiter({ limit: 40, windowMs: 10 * 60_000 });
  app.use("/api/public/currency", createLimiter({ limit: 60, windowMs: 10 * 60_000 }), currencyDisplayRoutes(currencyService));
  const verifyEnquiryChallenge = async (req, token) => {
    if (["staging", "production"].includes(environment) && !turnstileVerifier) {
      throw new TurnstileError(503, "service_unavailable",
        "Enquiry security verification is not configured. Please contact us on WhatsApp.");
    }
    if (turnstileVerifier) await turnstileVerifier({ token, origin: req.headers.origin });
  };
  const continuationTokenSchema = z.object({ continuationToken: z.string().min(80).max(256) }).strict();
  const continuationUnavailable = (req, res) => res.set("Cache-Control", "no-store").status(410).json(createErrorResponse({
    code: "gone", message: "This private questionnaire link is unavailable or has expired. Please send a new enquiry.",
  }, { requestId: req.requestId }));
  const validPublicRequest = (req) => allowedOrigins.includes(req.headers.origin) && req.is("application/json");

  app.post("/api/public/enquiries/continuation/context", createLimiter({ limit: 20, windowMs: 10 * 60_000 }), async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!validPublicRequest(req)) return res.status(403).json(createErrorResponse({
      code: "permission_error", message: "Open the private questionnaire from the Travel With Ease email.",
    }, { requestId: req.requestId }));
    const parsed = continuationTokenSchema.safeParse(req.body);
    const verified = parsed.success && continuationLinks?.verify(parsed.data.continuationToken);
    if (!verified || typeof repository?.continuationContext !== "function") return continuationUnavailable(req, res);
    try {
      const context = await repository.continuationContext(verified.enquiryId);
      if (!context) return continuationUnavailable(req, res);
      return res.json(createSuccessResponse({
        contact: context.contact,
        entryType: context.entryType,
        context: context.context,
        expiresAt: verified.expiresAt,
      }, { requestId: req.requestId }));
    } catch {
      logger.error?.({ requestId: req.requestId, eventName: "enquiry.continuation_context_failed" }, "Enquiry continuation could not be opened");
      return res.status(503).json(createErrorResponse({ code: "service_unavailable", message: "We could not open the questionnaire. Please try again shortly." }, { requestId: req.requestId }));
    }
  });

  app.post("/api/public/enquiries/continuation/complete", createLimiter({ limit: 10, windowMs: 10 * 60_000 }), async (req, res) => {
    res.set("Cache-Control", "no-store");
    if (!validPublicRequest(req)) return res.status(403).json(createErrorResponse({
      code: "permission_error", message: "Open the private questionnaire from the Travel With Ease email.",
    }, { requestId: req.requestId }));
    const continuationToken = typeof req.body?.continuationToken === "string" ? req.body.continuationToken : "";
    const verified = continuationLinks?.verify(continuationToken);
    if (!verified || typeof repository?.completeEnquiryContinuation !== "function") return continuationUnavailable(req, res);
    const questionnaire = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => key !== "continuationToken"),
    );
    const parsed = smartEnquirySchema.safeParse(questionnaire);
    if (!parsed.success) return res.status(400).json(createErrorResponse({
      code: "validation_error", message: "Please check your questionnaire details.", issues: issuesFor(parsed.error),
    }, { requestId: req.requestId }));
    if (parsed.data.website) return res.status(202).json(createSuccessResponse({ received: true }, { requestId: req.requestId }));
    try {
      await verifyEnquiryChallenge(req, parsed.data.turnstileToken);
      const result = await repository.completeEnquiryContinuation(verified.enquiryId, parsed.data);
      return res.status(result.replayed ? 200 : 201).json(createSuccessResponse(result, { requestId: req.requestId }));
    } catch (error) {
      if (error instanceof TurnstileError) return res.status(error.status).json(createErrorResponse({ code: error.code, message: error.message }, { requestId: req.requestId }));
      if (["enquiry_continuation_conflict", "enquiry_continuation_unavailable"].includes(error.code)) return continuationUnavailable(req, res);
      logger.error?.({ requestId: req.requestId, eventName: "enquiry.continuation_failed" }, "Enquiry continuation could not be saved");
      return res.status(503).json(createErrorResponse({ code: "service_unavailable", message: "We could not save the questionnaire. Your answers remain here so you can try again." }, { requestId: req.requestId }));
    }
  });

  app.post("/api/public/enquiries", createLimiter({ limit: 10, windowMs: 10 * 60_000 }), async (req, res) => {
    if (!allowedOrigins.includes(req.headers.origin) || !req.is("application/json")) {
      return res.status(403).json(createErrorResponse({
        code: "permission_error", message: "Submit your enquiry from the Travel With Ease website.",
      }, { requestId: req.requestId }));
    }
    const parsed = nativeInquirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(createErrorResponse({
      code: "validation_error", message: "Please check your enquiry details.", issues: issuesFor(parsed.error),
    }, { requestId: req.requestId }));
    if (parsed.data.website) return res.status(202).json(createSuccessResponse({ received: true }, { requestId: req.requestId }));
    try {
      await verifyEnquiryChallenge(req, parsed.data.turnstileToken);
      if (typeof repository?.createNativeEnquiry !== "function") throw new Error("Enquiry adapter unavailable.");
      const result = await repository.createNativeEnquiry(parsed.data);
      return res.status(result.replayed ? 200 : 201).json(createSuccessResponse(result, { requestId: req.requestId }));
    } catch (error) {
      if (error instanceof TurnstileError) return res.status(error.status).json(createErrorResponse({
        code: error.code, message: error.message,
      }, { requestId: req.requestId }));
      if (error.code === "enquiry_submission_conflict") return res.status(409).json(createErrorResponse({
        code: "conflict", message: "This submission reference was already used for different details. Start a new enquiry.",
      }, { requestId: req.requestId }));
      logger.error?.({ requestId: req.requestId, eventName: "enquiry.creation_failed" }, "Enquiry could not be saved");
      return res.status(503).json(createErrorResponse({
        code: "service_unavailable", message: "We could not confirm your enquiry. Keep this form open and try again, or contact us on WhatsApp.",
      }, { requestId: req.requestId }));
    }
  });
  app.post("/api/public/estimate", publicLimiter, async (req, res) => {
    const parsed = estimateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(createErrorResponse({ code: "validation_error", message: "Check the trip details.", issues: issuesFor(parsed.error) }, { requestId: req.requestId }));
    try {
      return res.json(createSuccessResponse(await estimatorService.estimate(parsed.data), { requestId: req.requestId }));
    } catch {
      logger.error?.({ requestId: req.requestId, eventName: "estimate.failed" }, "Currency estimate unavailable");
      return res.status(503).json(createErrorResponse({ code: "service_unavailable", message: "Live estimate rates are temporarily unavailable. Please try again." }, { requestId: req.requestId }));
    }
  });

  app.post("/api/public/inquiries", publicLimiter, async (req, res) => {
    const parsed = inquirySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(createErrorResponse({ code: "validation_error", message: "Check the inquiry details.", issues: issuesFor(parsed.error) }, { requestId: req.requestId }));
    if (parsed.data.website) return res.status(202).json(createSuccessResponse({ received: true }, { requestId: req.requestId }));
    try {
      await verifyEnquiryChallenge(req, parsed.data.turnstileToken);
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
      if (error instanceof TurnstileError) return res.status(error.status).json(createErrorResponse({
        code: error.code, message: error.message,
      }, { requestId: req.requestId }));
      logger.error?.({ requestId: req.requestId, eventName: "inquiry.failed" }, "Inquiry creation failed");
      return res.status(503).json(createErrorResponse({ code: "service_unavailable", message: "We could not save your inquiry. Please try again." }, { requestId: req.requestId }));
    }
  });

  app.get("/api/agent/leads", async (req, res) => {
    const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!req.staff && (!agentToken || !safeEqual(supplied, agentToken))) return res.status(401).json(createErrorResponse({ code: "authentication_error", message: "Authentication is required." }, { requestId: req.requestId }));
    return res.json(createSuccessResponse({ items: await repository.listLeads() }, { requestId: req.requestId }));
  });

  if (inlinePortal) app.use(inlinePortal.serve);
  app.use((req, res) => res.status(404).json(createErrorResponse({ code: "not_found", message: "Route not found." }, { requestId: req.requestId })));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === "entity.too.large" ? 413
      : error.type === "entity.parse.failed" ? 400
        : error.status === 415 ? 415 : 500;
    logger.error?.({ requestId: req.requestId, eventName: "request.failed", status }, "Request failed");
    return res.status(status).json(createErrorResponse({
      code: status < 500 ? "validation_error" : "server_error",
      message: status === 413 ? "Request body is too large." : status < 500 ? "Request body is invalid." : "The service could not complete the request.",
    }, { requestId: req.requestId }));
  });
  return app;
};
