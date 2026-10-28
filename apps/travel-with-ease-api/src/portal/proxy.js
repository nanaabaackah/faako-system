import express from "express";
import { createErrorResponse, errorCodeForStatus, resolveRequestId } from "@faako/api-contracts";
import { buildSecurityHeaders } from "@faako/security";

const id = "[a-fA-F0-9-]{36}";
const page = "(?:home|about|services|faqs|testimonials|contact)";
const routes = [
  ["GET", /^\/api\/auth\/(status|session)$/],
  ["POST", /^\/api\/auth\/(access-session|logout|logout-all)$/],
  ["GET", /^\/api\/agent\/leads$/],
  ["GET", /^\/api\/agent\/inquiries(?:\/[a-fA-F0-9-]{36})?$/],
  ["POST", /^\/api\/agent\/inquiries\/[a-fA-F0-9-]{36}\/status$/],
  ["GET", /^\/api\/agent\/administration\/(diagnostics|security-events|staff)$/],
  ["POST", /^\/api\/agent\/administration\/(staff|support-grants)$/],
  ["POST", new RegExp(`^/api/agent/administration/staff/${id}/(?:status|revoke-sessions)$`)],
  ["POST", new RegExp(`^/api/agent/administration/support-grants/${id}/revoke$`)],
  ["GET", new RegExp(`^/api/agent/content(?:/publication-jobs|/${page}(?:/(?:preview|revisions))?)?/?$`)],
  ["POST", new RegExp(`^/api/agent/content/(?:publication-jobs/${id}/retry|${page}/(?:draft|publish|unpublish|revert/${id}))$`)],
  ["GET", new RegExp(`^/api/agent/media(?:/${id}/preview)?/?$`)],
  ["POST", new RegExp(`^/api/agent/media/(?:upload|${id}/(?:replace|archive))$`)],
];

export const isAllowedPortalApiRoute = (method, pathname) =>
  routes.some(([allowedMethod, pattern]) => allowedMethod === method && pattern.test(pathname));

export function readPortalUpstream(value, environment) {
  let url;
  try { url = new URL(value); } catch { throw new Error("TWE_PORTAL_API_ORIGIN must be an exact API origin."); }
  const local = ["test", "development"].includes(environment) && ["127.0.0.1", "localhost"].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) {
    throw new Error("The hosted portal requires a fixed HTTPS API origin without credentials or paths.");
  }
  return url.origin;
}

export function createPortalApp({ settings, upstream, distDirectory, verifier, logger = {}, fetchImpl = fetch }) {
  if (!settings || !verifier) throw new Error("The portal requires Cloudflare Access verification.");
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);
  const fail = (req, res, status) => res.status(status).json(createErrorResponse({
    code: errorCodeForStatus(status), message: status === 401 ? "Cloudflare Access authentication is required." : "The portal request could not be completed.",
  }, { requestId: req.requestId }));
  app.use((req, res, next) => {
    req.requestId = resolveRequestId(req.headers["x-request-id"]);
    res.set(buildSecurityHeaders({ profileId: "authenticated-workspace", extraHeaders: {
      "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'",
      "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "X-Request-Id": req.requestId,
    } }));
    next();
  });
  // Liveness only: deliberately reveals neither upstream configuration nor readiness.
  app.get("/healthz", (_req, res) => res.json({ ok: true, service: "travel-with-ease-portal" }));
  app.use(async (req, res, next) => {
    if (req.headers.host !== new URL(settings.portalOrigin).host) return fail(req, res, 403);
    const assertions = req.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === "cf-access-jwt-assertion");
    if (assertions.length !== 1) return fail(req, res, 401);
    try { await verifier.verify(req.headers["cf-access-jwt-assertion"]); } catch { return fail(req, res, 401); }
    next();
  });
  app.use((req, res, next) => {
    if (!req.url.startsWith("/api")) return next();
    // Reject encoded/ambiguous paths before URL normalization; no caller-controlled host.
    const pathname = req.url.split("?")[0];
    if (!isAllowedPortalApiRoute(req.method, pathname)) return fail(req, res, 404);
    if (req.url.length > 4096 || /[\\#]/.test(req.url)) return fail(req, res, 400);
    if (req.method === "POST" && req.headers.origin !== settings.portalOrigin) return fail(req, res, 403);
    const upload = /\/media\/(?:upload|[a-fA-F0-9-]{36}\/replace)$/.test(pathname);
    express.raw({ type: () => true, limit: upload ? "8mb" : "32kb", inflate: false })(req, res, next);
  });
  app.use(async (req, res, next) => {
    if (!req.url.startsWith("/api")) return next();
    const headers = { "x-request-id": req.requestId, "accept-encoding": "identity" };
    for (const name of ["cf-access-jwt-assertion", "origin", "content-type", "x-csrf-token", "x-twe-session-init", "x-media-alt", "x-media-rights"]) {
      if (typeof req.headers[name] === "string") headers[name] = req.headers[name];
    }
    // Forward only this application's session cookie, not Cloudflare/other-site cookies.
    const cookieName = settings.secure ? "__Host-twe_session" : "twe_session";
    const cookies = String(req.headers.cookie || "").split(";").map(value => value.trim()).filter(value => value.startsWith(`${cookieName}=`));
    if (cookies.length > 1) return fail(req, res, 400);
    if (cookies.length) headers.cookie = cookies[0];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", disconnect);
    try {
      const response = await fetchImpl(`${upstream}${req.url}`, {
        method: req.method, headers, redirect: "manual", signal: controller.signal,
        ...(req.method === "POST" ? { body: req.body } : {}),
      });
      // Never follow or relay upstream redirects containing credential-bearing requests.
      if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); return fail(req, res, 502); }
      const chunks = []; let size = 0;
      for await (const chunk of response.body || []) {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) throw new Error("Response limit exceeded.");
        chunks.push(chunk);
      }
      for (const name of ["content-type", "content-disposition", "retry-after"]) {
        if (response.headers.has(name)) res.setHeader(name, response.headers.get(name));
      }
      const setCookies = response.headers.getSetCookie().filter(value => value.startsWith(`${cookieName}=`));
      if (setCookies.length) res.setHeader("Set-Cookie", setCookies);
      res.status(response.status).send(Buffer.concat(chunks));
    } catch {
      controller.abort();
      logger.warn?.({ requestId: req.requestId, eventName: "portal.upstream.failed" }, "Portal upstream unavailable");
      if (!res.destroyed) fail(req, res, 502);
    } finally { clearTimeout(timer); res.off("close", disconnect); }
  });
  app.use(express.static(distDirectory, { dotfiles: "deny", index: "index.html", etag: false, lastModified: false, cacheControl: false }));
  app.use((req, res) => fail(req, res, 404));
  app.use((error, req, res, _next) => fail(req, res, [400, 413, 415].includes(error.status) ? error.status : 500));
  return app;
}
