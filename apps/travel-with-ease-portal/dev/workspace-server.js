// Operator-requested loopback preview. Never imported by the portal or real API.
import { createServer } from "node:http";
import { createWorkspaceFixture } from "../test/fixtures/workspace.js";
import { ROLE_PERMISSIONS } from "../../travel-with-ease-api/src/auth/permissions.js";
import {
  allowedTutorials,
  transitionProgress,
  tutorialVersion,
} from "../../travel-with-ease-api/src/onboarding/catalogue.js";

export function assertPreviewEnvironment(env) {
  if (
    env.TWE_WORKSPACE_PREVIEW !== "true" ||
    !["development", "test"].includes(env.APP_ENV) ||
    env.NODE_ENV === "production" ||
    env.RAILWAY_ENVIRONMENT_ID ||
    env.CF_PAGES ||
    env.DATABASE_URL ||
    env.TWE_MIGRATION_DATABASE_URL ||
    env.TWE_RESEND_API_KEY
  ) {
    throw new Error(
      "Workspace preview requires an isolated local environment without hosted credentials.",
    );
  }
}

const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const roles = Object.keys(ROLE_PERMISSIONS);
function permissionFor(path, method) {
  if (path.startsWith("/api/agent/content"))
    return method === "GET"
      ? "content.read"
      : /\/(publish|unpublish|retry)$/.test(path)
        ? "content.publish"
        : "content.write";
  if (path.startsWith("/api/agent/media"))
    return method === "GET" ? "media.read" : "media.write";
  if (path.startsWith("/api/agent/inquiries"))
    return method === "GET" ? "enquiries.read" : "enquiries.write";
  if (path.startsWith("/api/agent/templates")) return "templates.manage";
  if (path.includes("/security-activity")) return "security.read";
  if (path.includes("/diagnostics")) return "system.read";
  if (path.includes("/activity")) return "audit.business.read";
  if (
    path.startsWith("/api/agent/administration") ||
    path === "/api/auth/invitations"
  )
    return "staff.manage";
  return null;
}

export function createWorkspaceServer(env) {
  assertPreviewEnvironment(env);
  let role = "owner",
    fixture,
    progress;
  function reset() {
    fixture = createWorkspaceFixture({ role, interactivePreview: true });
    progress = {
      status: "paused",
      enabled: false,
      completed: [],
      position: null,
      revision: 1,
      last_completed_version: 0,
    };
  }
  reset();
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const reply = (status, value) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(value));
    };
    try {
      const host = req.headers.host || "";
      if (
        !/^(localhost|127\.0\.0\.1):\d+$/.test(host) ||
        req.headers["x-forwarded-host"] ||
        req.headers["x-forwarded-for"]
      )
        fail(403, "Loopback workspace only.");
      const origin = req.headers.origin;
      if (
        origin &&
        !/^http:\/\/(localhost|127\.0\.0\.1):(5188|4328)$/.test(origin)
      )
        fail(403, "Foreign origin denied.");
      if (req.headers["sec-fetch-site"] === "cross-site")
        fail(403, "Cross-site requests denied.");
      const url = new URL(req.url, "http://" + host);
      if (!["GET", "POST"].includes(req.method))
        fail(405, "Unsupported preview method.");
      let json;
      if (req.method === "POST") {
        if (!String(req.headers["content-type"]).startsWith("application/json"))
          fail(415, "JSON required.");
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 500_000)
            fail(413, "Preview input too large.");
        }
        try {
          json = JSON.parse(body || "{}");
        } catch {
          fail(400, "Invalid JSON.");
        }
        if (!json || typeof json !== "object" || Array.isArray(json))
          fail(400, "Object required.");
        if (url.pathname.startsWith("/__workspace")) {
          if (req.headers["x-twe-workspace"] !== "local-preview")
            fail(403, "Preview control header required.");
        } else if (req.headers["x-csrf-token"] !== "synthetic-not-a-credential")
          fail(403, "Preview mutation token required.");
      }
      if (url.pathname === "/__workspace") {
        if (req.method === "POST") {
          if (json.action === "role" && roles.includes(json.role))
            role = json.role;
          else if (json.action !== "reset")
            fail(400, "Choose a preview role or reset.");
          reset();
        }
        return reply(200, { role, preview: true, persistence: "memory only" });
      }
      if (!url.pathname.startsWith("/api/"))
        fail(404, "Unknown preview route.");
      const permission = permissionFor(url.pathname, req.method);
      if (permission && !ROLE_PERMISSIONS[role].includes(permission))
        fail(403, "This preview role cannot access this module.");
      let data;
      if (url.pathname === "/api/auth/tutorials") {
        const catalogue = allowedTutorials(ROLE_PERMISSIONS[role]);
        if (req.method === "POST") {
          if (json.revision !== progress.revision)
            fail(409, "Reload changed tutorial progress.");
          try {
            progress = {
              ...transitionProgress(progress, json, catalogue),
              revision: progress.revision + 1,
            };
          } catch {
            fail(400, "Choose an available tutorial action.");
          }
        }
        data = { progress, catalogue, version: tutorialVersion };
      } else if (
        req.method === "GET" &&
        /\/media\/[^/]+\/preview$/.test(url.pathname)
      ) {
        // Synthetic, local image. There is no Google Drive or R2 connection.
        res.writeHead(200, {
          "Content-Type": "image/svg+xml",
          "Content-Security-Policy": "default-src 'none'; style-src 'none'",
        });
        return res.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#f4ede3"/></svg>',
        );
      } else {
        data =
          req.method === "GET"
            ? await fixture.get(url.pathname + url.search)
            : await fixture.post(url.pathname + url.search, { json });
      }
      reply(200, {
        ok: true,
        data,
        meta: { requestId: "isolated-local-workspace" },
      });
    } catch (error) {
      const status = [400, 401, 403, 404, 405, 409, 413, 415, 503].includes(
        error.status,
      )
        ? error.status
        : 500;
      reply(status, {
        ok: false,
        error: {
          code: status === 403 ? "authorization_error" : "validation_error",
          message:
            status === 500
              ? "Local preview could not complete this operation."
              : error.message,
        },
        meta: { requestId: "isolated-local-workspace" },
      });
    }
  });
}
