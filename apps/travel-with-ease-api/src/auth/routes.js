import { Router } from "express";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createErrorResponse, createSuccessResponse } from "@faako/api-contracts";
import { hasPermission, ROLE_PERMISSIONS, validSupportGrant } from "./permissions.js";

const accessAdapters = new WeakMap();
export const accessAdapterDetails = (auth) => accessAdapters.get(auth);

const hash = (value) => createHash("sha256").update(value).digest("hex");
const csrfFor = (token) => createHmac("sha256", token).update("twe-csrf-v1").digest("base64url");
const newToken = () => randomBytes(32).toString("base64url");
const tokenFrom = (req, name) => {
  const matches = String(req.headers.cookie || "").split(";").map((value) => value.trim()).filter((value) => value.startsWith(`${name}=`));
  if (matches.length !== 1) return "";
  const value = matches[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
};
const reject = (req, res, status, code, message) => res.status(status).json(createErrorResponse({ code, message }, { requestId: req.requestId }));

export function createStaffAuth({ store, provider, settings, limiter, logger, administration }) {
  const router = Router();
  const secure = settings?.secure ?? false;
  const sessionName = secure ? "__Host-twe_session" : "twe_session";
  const flowName = secure ? "__Host-twe_flow" : "twe_flow";
  const cookie = { httpOnly: true, secure, sameSite: "lax", path: "/" };
  const configured = Boolean(store && provider && settings);
  const accessMode = settings?.mode === "cloudflare_access";

  async function verifiedAccess(req) {
    // Duplicate headers are rejected, not joined or chosen by order.
    if (req.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === "cf-access-jwt-assertion").length !== 1) throw new Error("Missing or ambiguous assertion");
    return provider.verify(req.get("Cf-Access-Jwt-Assertion"));
  }

  async function requireStaff(req, res, next) {
    if (req.get("Origin") && req.get("Origin") !== settings?.portalOrigin) return reject(req, res, 403, "permission_error", "Staff requests must originate from the portal.");
    const token = tokenFrom(req, sessionName);
    if (!configured || !token) return reject(req, res, 401, "authentication_error", "Sign in to continue.");
    const session = await store.getSession(hash(token));
    if (!session || !Object.hasOwn(ROLE_PERMISSIONS, session.role) || (!accessMode && session.role === "platform_admin") || !(new Date(session.expires_at).getTime() > Date.now())) return reject(req, res, 401, "authentication_error", "Your session has expired. Sign in again.");
    if (accessMode) {
      try {
        const identity = await verifiedAccess(req);
        if (identity.issuer !== session.issuer || identity.subject !== session.subject || identity.audience !== session.access_audience || identity.assertionHash !== session.access_assertion_hash) throw new Error("Session identity mismatch");
      } catch {
        await store.recordDenied(req.requestId);
        return reject(req, res, 401, "authentication_error", "Access identity could not be verified. Sign in again.");
      }
    }
    req.staff = { id: session.id, role: session.role, organisationId: store.organisationId, permissions: ROLE_PERMISSIONS[session.role] };
    req.staffSession = { hash: hash(token), csrf: csrfFor(token), csrfHash: session.csrf_hash, expiresAt: session.expires_at };
    next();
  }

  async function requireAccessIdentity(req, res, next) {
    if (!configured || !accessMode) return reject(req, res, 401, "authentication_error", "Access sign-in is required.");
    if (req.get("Origin") && req.get("Origin") !== settings.portalOrigin) return reject(req, res, 403, "permission_error", "Use the workspace portal.");
    try { req.accessIdentity = await verifiedAccess(req); }
    catch { return reject(req, res, 401, "authentication_error", "Access identity could not be verified."); }
    next();
  }

  function requireAccessMutation(req, res, next) {
    // Pre-session activation has no ambient application cookie. Require a
    // verified edge assertion plus same-origin custom-header POST (no CORS fallback).
    if (req.get("Origin") !== settings?.portalOrigin || req.get("X-TWE-Session-Init") !== "1") return reject(req, res, 403, "permission_error", "Refresh the portal before activating your account.");
    next();
  }

  function requireMutation(req, res, next) {
    const supplied = req.get("X-CSRF-Token");
    if (!req.staffSession || req.get("Origin") !== settings?.portalOrigin || typeof supplied !== "string" || supplied.length > 100 ||
        !timingSafeEqual(Buffer.from(hash(supplied)), Buffer.from(req.staffSession.csrfHash))) {
      return reject(req, res, 403, "permission_error", "Refresh your session before making changes.");
    }
    next();
  }

  function requireOwner(req, res, next) {
    if (req.staff?.role !== "owner") return reject(req, res, 403, "permission_error", "Owner access is required.");
    next();
  }

  function requirePermission(permission) {
    return async (req, res, next) => {
      if (!hasPermission(req.staff, permission, store?.organisationId)) {
        const grant = administration && req.staff?.role === "platform_admin" && permission === "enquiries.read"
          ? await administration.supportGrant(req.staff.id) : null;
        if (!validSupportGrant(grant, req.staff, permission, store?.organisationId)) return reject(req, res, 403, "permission_error", "You do not have permission for this action.");
        await administration.auditSupportUse(req.staff, grant, req.requestId);
      }
      next();
    };
  }

  router.get("/status", (req, res) => res.json(createSuccessResponse({ configured, mode: accessMode ? "cloudflare_access" : "unconfigured",
    recoveryUrl: configured ? settings.recoveryUrl || null : null,
    registrationUrl: configured ? settings.registrationUrl || null : null,
  }, { requestId: req.requestId })));
  router.post("/access-session", limiter, async (req, res) => {
    if (!configured || !accessMode) return reject(req, res, 503, "service_unavailable", "Access sign-in has not been configured.");
    if (req.get("Origin") !== settings.portalOrigin || req.get("X-TWE-Session-Init") !== "1") return reject(req, res, 403, "permission_error", "Start sign-in from the staff portal.");
    try {
      const identity = await verifiedAccess(req);
      const token = newToken();
      const user = await store.createSession(identity, hash(token), hash(csrfFor(token)), req.requestId);
      if (!user) { await store.recordDenied(req.requestId); return reject(req, res, 403, "permission_error", "Your identity is not provisioned for this workspace. Contact your owner."); }
      const previous = tokenFrom(req, sessionName);
      if (previous) await store.revoke(hash(previous), req.requestId);
      res.cookie(sessionName, token, cookie);
      res.status(201).json(createSuccessResponse({ signedIn: true }, { requestId: req.requestId }));
    } catch {
      await store.recordDenied(req.requestId);
      return reject(req, res, 401, "authentication_error", "Access sign-in failed or was already used. Reauthenticate through Cloudflare Access.");
    }
  });
  router.get("/login", limiter, async (req, res) => {
    if (accessMode) return res.redirect(303, settings.portalOrigin);
    if (!configured) return reject(req, res, 503, "service_unavailable", "Staff sign-in has not been configured.");
    if (req.query.remember !== undefined && !["0", "1"].includes(req.query.remember)) return reject(req, res, 400, "validation_error", "Invalid sign-in preference.");
    const flow = await provider.begin();
    const token = newToken();
    await store.saveFlow(hash(token), { ...flow, remember_me: req.query.remember === "1" });
    res.cookie(flowName, token, { ...cookie, maxAge: 300_000 });
    res.redirect(303, flow.url);
  });
  router.get("/callback", limiter, async (req, res) => {
    if (accessMode) return reject(req, res, 404, "not_found", "Route not found.");
    const token = tokenFrom(req, flowName);
    res.clearCookie(flowName, cookie);
    if (!configured || !token) return reject(req, res, 401, "authentication_error", "Sign-in could not be verified. Start again.");
    try {
      const flow = await store.consumeFlow(hash(token));
      if (!flow) throw new Error("Expired or replayed sign-in");
      const url = new URL(settings.callbackUrl);
      // Never derive the callback origin from Host or forwarded headers.
      url.search = new URL(req.originalUrl, settings.callbackUrl).search;
      const identity = await provider.complete(url, flow);
      const sessionToken = newToken();
      const user = await store.createSession(identity, hash(sessionToken), hash(csrfFor(sessionToken)), req.requestId);
      if (!user) throw new Error("Staff not provisioned");
      const previous = tokenFrom(req, sessionName);
      if (previous) await store.revoke(hash(previous), req.requestId);
      res.cookie(sessionName, sessionToken, { ...cookie, ...(flow.remember_me === true ? { maxAge: 3_600_000 } : {}) });
      return res.redirect(303, settings.portalOrigin);
    } catch {
      try { await store.recordDenied(req.requestId); }
      catch { logger?.error({ eventName: "auth.audit_failed", requestId: req.requestId }, "Sign-in denial could not be audited"); }
      logger?.warn({ eventName: "auth.denied", requestId: req.requestId }, "Staff sign-in denied");
      return reject(req, res, 401, "authentication_error", "Sign-in could not be verified. Start again.");
    }
  });
  router.get("/session", requireStaff, (req, res) => res.json(createSuccessResponse({ user: req.staff, csrfToken: req.staffSession.csrf, expiresAt: req.staffSession.expiresAt }, { requestId: req.requestId })));
  router.post("/logout", requireStaff, requireMutation, async (req, res) => {
    await store.revoke(req.staffSession.hash, req.requestId);
    res.clearCookie(sessionName, cookie);
    res.json(createSuccessResponse({ signedOut: true }, { requestId: req.requestId }));
  });
  router.post("/logout-all", requireStaff, requireMutation, async (req, res) => {
    await store.revokeAll(req.staff.id, req.requestId);
    res.clearCookie(sessionName, cookie);
    res.json(createSuccessResponse({ signedOut: true }, { requestId: req.requestId }));
  });
  const adapter = { router, requireStaff, requireMutation, requireOwner, requirePermission, requireAccessIdentity, requireAccessMutation };
  if (configured && accessMode) accessAdapters.set(adapter, { store, settings });
  return adapter;
}
