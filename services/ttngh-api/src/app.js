import express from "express";
import { rateLimit } from "express-rate-limit";
import { createHash } from "node:crypto";
import { isValidSignature, decodeSignatureHeader } from "@sanity/webhook";
import { createErrorResponse, createSuccessResponse, errorCodeForStatus } from "@faako/api-contracts";
import { createRequestContextMiddleware } from "@faako/logger";
import { buildApiSecurityHeaders } from "@faako/security";
import { enquirySchema, verifyTurnstile } from "./enquiry.js";
import { processPendingEnquiries } from "./contact/delivery.js";
import { mountCalendar } from "./calendar/route.js";

const types = new Set(["siteSettings", "homePage", "programme", "event", "newsArticle", "resource", "teamMember", "impactStat", "partner"]);
export function createApp(config, { request = fetch, verifySignature = isValidSignature, enquiryStore, contactReady = () => Boolean(enquiryStore) } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustedProxies.length ? config.trustedProxies : false);
  app.use(createRequestContextMiddleware({ application: "ttngh-api" }));
  app.use((req, res, next) => {
    res.set(buildApiSecurityHeaders({ allowedOrigins: config.origins, origin: req.headers.origin, allowCredentials: false, methods: "POST,OPTIONS", allowHeaders: "Content-Type,X-Request-Id" }));
    res.set("Access-Control-Expose-Headers", "X-Request-Id,Retry-After");
    next();
  });
  const fail = (req, res, status, message) => res.status(status).json(createErrorResponse({ code: errorCodeForStatus(status), message }, { requestId: req.requestId }));
  const ok = (req, res, data) => res.json(createSuccessResponse(data, { requestId: req.requestId }));
  // Liveness is independent of optional contact database readiness.
  app.get("/health", (req, res) => ok(req, res, {
    status: "ok",
    enquiries: !config.enabled ? "disabled" : contactReady() ? "ready" : "unavailable"
  }));
  mountCalendar(app, config, { request, fail, ok });
  const limit = rateLimit({ windowMs: config.windowMs, limit: config.limit, standardHeaders: "draft-8", legacyHeaders: false, handler: (req, res) => fail(req, res, 429, "Too many attempts. Please try again later.") });
  app.use("/api/enquiries", (req, res, next) => {
    if (!config.origins.includes(req.headers.origin)) return fail(req, res, 403, "This origin is not permitted.");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    if (!config.enabled) return fail(req, res, 503, "Online enquiries are not available. Please use our contact details.");
    if (!req.is("application/json")) return fail(req, res, 415, "Send JSON content.");
    next();
  }, limit);
  app.post("/api/enquiries", express.json({ limit: "16kb", strict: true, inflate: false }), async (req, res) => {
    const parsed = enquirySchema.safeParse(req.body);
    if (!parsed.success) return fail(req, res, 400, "Please check the required fields and privacy consent.");
    const input = parsed.data;
    if (input.website) return fail(req, res, 400, "Unable to submit this enquiry.");
    if (!enquiryStore || !contactReady()) return fail(req, res, 503, "Enquiries are temporarily unavailable. Please use our contact details.");
    try {
      if (!await verifyTurnstile(input.turnstileToken, config, request))
        return fail(req, res, 400, "Verification expired or failed. Please complete a new check.");
    } catch {
      req.log.warn({ event: "enquiry_verification_unavailable" });
      return fail(req, res, 503, "Security verification is temporarily unavailable. Please try again.");
    }
    try {
      await enquiryStore.create(input, { acknowledgement: config.acknowledgement });
    } catch {
      req.log.warn({ event: "enquiry_storage_unavailable" });
      return fail(req, res, 503, "Your enquiry could not be saved. Please try again.");
    }
    // Persistence is the acceptance boundary. Provider outages cannot lose the
    // message; the durable outbox worker retries without asking the visitor.
    try {
      const outcome = await processPendingEnquiries(enquiryStore, config, {
        request, submissionId: input.submissionId, limit: 2
      });
      if (outcome.failed) req.log.warn({ event: "enquiry_notification_queued" });
    } catch {
      req.log.warn({ event: "enquiry_dispatch_deferred" });
    }
    req.log.info({ event: "enquiry_saved" });
    return ok(req, res, { accepted: true, reference: input.submissionId });
  });
  const received = new Map();
  app.post("/api/webhooks/sanity", rateLimit({ windowMs: 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, handler: (req, res) => fail(req, res, 429, "Please retry later.") }), express.text({ type: "application/json", limit: "16kb", inflate: false }), async (req, res) => {
    if (!config.webhookSecret || !config.buildHook || !config.project || !config.dataset) return fail(req, res, 503, "Publishing is not configured.");
    if (!req.is("application/json") || typeof req.body !== "string") return fail(req, res, 415, "Send JSON content.");
    const signature = req.get("sanity-webhook-signature") || "";
    try {
      if (!await verifySignature(req.body, signature, config.webhookSecret)) return fail(req, res, 401, "Invalid signature.");
      const age = Date.now() - decodeSignatureHeader(signature).timestamp;
      if (age < -30000 || age > 300000) return fail(req, res, 401, "Expired signature.");
      const data = JSON.parse(req.body);
      if (data.projectId !== config.project || data.dataset !== config.dataset || !types.has(data.type) || typeof data.id !== "string" || /^(drafts|versions)\./.test(data.id)) return fail(req, res, 400, "Invalid publishing event.");
      const key = createHash("sha256").update(req.body).digest("hex");
      const now = Date.now();
      for (const [id, at] of received) if (now - at > 600000) received.delete(id);
      if (received.has(key)) return ok(req, res, { queued: true });
      if (received.size >= 1000) return fail(req, res, 429, "Please retry later.");
      received.set(key, now);
      try {
        const result = await request(config.buildHook, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10000) });
        if (!result.ok) throw new Error("Build unavailable");
      } catch { received.delete(key); throw new Error("Build unavailable"); }
      req.log.info({ event: "cms_build_requested" });
      return ok(req, res, { queued: true });
    } catch { return fail(req, res, 503, "Publishing could not be confirmed. Please retry."); }
  });
  app.use((req, res) => fail(req, res, 404, "Endpoint not found."));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === "entity.too.large" ? 413 : error.type === "encoding.unsupported" ? 415 : error instanceof SyntaxError ? 400 : 500;
    req.log.warn({ event: "request_rejected", status });
    fail(req, res, status, status === 500 ? "Unable to process this request." : "Invalid request content.");
  });
  return app;
}
