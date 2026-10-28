import express from "express";
import { createErrorResponse, errorCodeForStatus } from "@faako/api-contracts";
import { buildSecurityHeaders } from "@faako/security";
import { isAllowedPortalApiRoute } from "./proxy.js";
import { accessFailureReason } from "../auth/access-diagnostics.js";

// A single Railway process can expose two hostnames: the protected CMS hostname
// and the existing API hostname. Do not proxy HTTP requests back into this process.
export function createInlinePortal({ settings, verifier, distDirectory, logger }) {
  if (!settings?.portalOrigin || !verifier?.verify || !distDirectory) {
    throw new Error("The embedded portal requires Access verification and a built frontend.");
  }
  const portalHost = new URL(settings.portalOrigin).host;
  const staticFiles = express.static(distDirectory, {
    dotfiles: "deny", index: "index.html", etag: false,
    lastModified: false, cacheControl: false,
  });
  const reject = (req, res, status) => res.status(status).json(createErrorResponse({
    code: errorCodeForStatus(status),
    message: status === 401
      ? "Cloudflare Access authentication is required."
      : "The portal request could not be completed.",
  }, { requestId: req.requestId }));

  const guard = async (req, res, next) => {
    if (req.headers.host !== portalHost) return next();

    res.set(buildSecurityHeaders({ profileId: "authenticated-workspace", extraHeaders: {
      "Content-Security-Policy": "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    } }));

    // The shared Railway service uses /healthz and /readyz for operations.
    // All other portal-host requests require a verified Access assertion.
    if (req.path === "/healthz") return next();
    const rejectAuthentication = (reason) => {
      // Diagnostic, not a staff audit event: no verified identity exists yet.
      // Keep failures fail-closed even if the logging transport is unavailable.
      try {
        logger?.warn?.({
          eventName: "portal.access.rejected",
          requestId: req.requestId,
          reason,
        }, "Portal Access assertion rejected.");
      } catch { /* Logging must not change the authentication decision. */ }
      return reject(req, res, 401);
    };
    const assertions = req.rawHeaders.filter((name, index) => (
      index % 2 === 0 && name.toLowerCase() === "cf-access-jwt-assertion"
    ));
    if (assertions.length !== 1 || typeof req.headers["cf-access-jwt-assertion"] !== "string") {
      return rejectAuthentication(assertions.length === 0 ? "assertion_missing" : "assertion_header_invalid");
    }
    try {
      await verifier.verify(req.headers["cf-access-jwt-assertion"]);
    } catch (error) {
      return rejectAuthentication(accessFailureReason(error));
    }

    if (req.url.startsWith("/api")) {
      const pathname = req.url.split("?")[0];
      if (req.url.length > 4096 || /[\\#]/.test(req.url)) return reject(req, res, 400);
      if (!isAllowedPortalApiRoute(req.method, pathname)) return reject(req, res, 404);
      if (req.method === "POST" && req.headers.origin !== settings.portalOrigin) return reject(req, res, 403);
    } else if (req.method !== "GET" && req.method !== "HEAD") {
      return reject(req, res, 404);
    }
    return next();
  };

  const serve = (req, res, next) => {
    if (req.headers.host !== portalHost || req.url.startsWith("/api")) return next();
    return staticFiles(req, res, next);
  };
  return { guard, serve };
}
